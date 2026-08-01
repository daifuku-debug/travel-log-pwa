import type { MediaAssetReference } from '../../domain/media/mediaAssetReferences.ts';
import type { EntityId } from '../../domain/models/common.ts';
import type { MediaAsset, MediaAssetUsage } from '../../domain/models/scrapbook.ts';
import type { MediaAssetBlobRepository, MediaAssetRepository } from '../../domain/repositories/ScrapbookRepository.ts';
import { AppError } from '../../shared/errors.ts';
import type { FindMediaAssetReferencesInput } from './mediaAssetReferenceLogic.ts';

export type MediaAssetDeletionErrorCode =
  | 'transient-reference'
  | 'reference-search-failed'
  | 'referenced'
  | 'metadata-read-failed'
  | 'metadata-delete-failed'
  | 'blob-delete-failed';

export interface DeleteUnreferencedMediaAssetInput {
  assetId: EntityId;
  protectedAssetIds?: readonly EntityId[];
}

export interface DeleteUnreferencedMediaAssetResult {
  assetId: EntityId;
  tripId?: EntityId;
  usage?: MediaAssetUsage;
  metadataWasPresent: boolean;
  metadataDeleted: true;
  blobsDeleted: true;
  removeFromLists: true;
}

export interface MediaAssetDeletionDependencies {
  mediaAssets: Pick<MediaAssetRepository, 'getById' | 'softDelete'>;
  mediaAssetBlobs: Pick<MediaAssetBlobRepository, 'deleteByAssetId'>;
  findReferences: (input: FindMediaAssetReferencesInput) => Promise<MediaAssetReference[]>;
}

export class MediaAssetDeletionError extends AppError {
  readonly code: MediaAssetDeletionErrorCode;
  readonly assetId: EntityId;
  readonly references: MediaAssetReference[];
  readonly metadataDeleted: boolean;
  readonly retryable: boolean;

  constructor({
    code,
    assetId,
    message,
    cause,
    references = [],
    metadataDeleted = false,
    retryable = false,
  }: {
    code: MediaAssetDeletionErrorCode;
    assetId: EntityId;
    message: string;
    cause?: unknown;
    references?: MediaAssetReference[];
    metadataDeleted?: boolean;
    retryable?: boolean;
  }) {
    super(message, cause);
    this.name = 'MediaAssetDeletionError';
    this.code = code;
    this.assetId = assetId;
    this.references = references;
    this.metadataDeleted = metadataDeleted;
    this.retryable = retryable;
  }
}

export async function deleteUnreferencedMediaAssetWithDependencies(
  input: DeleteUnreferencedMediaAssetInput,
  dependencies: MediaAssetDeletionDependencies,
): Promise<DeleteUnreferencedMediaAssetResult> {
  if (input.protectedAssetIds?.includes(input.assetId)) {
    throw new MediaAssetDeletionError({
      code: 'transient-reference',
      assetId: input.assetId,
      message: '編集中の表紙で選択している写真は削除できません。',
    });
  }

  let asset: MediaAsset | undefined;
  try {
    asset = await dependencies.mediaAssets.getById(input.assetId);
  } catch (error) {
    throw new MediaAssetDeletionError({
      code: 'metadata-read-failed',
      assetId: input.assetId,
      message: '写真情報を確認できなかったため、削除しませんでした。',
      cause: error,
      retryable: true,
    });
  }

  let references: MediaAssetReference[];
  try {
    references = await dependencies.findReferences({
      assetId: input.assetId,
      tripId: asset?.tripId,
    });
  } catch (error) {
    throw new MediaAssetDeletionError({
      code: 'reference-search-failed',
      assetId: input.assetId,
      message: '写真の使用状況を確認できなかったため、削除しませんでした。',
      cause: error,
      retryable: true,
    });
  }

  if (references.length > 0) {
    throw new MediaAssetDeletionError({
      code: 'referenced',
      assetId: input.assetId,
      message: '表紙や本文で使用中のため削除できません。',
      references,
    });
  }

  try {
    await dependencies.mediaAssets.softDelete(input.assetId);
  } catch (error) {
    throw new MediaAssetDeletionError({
      code: 'metadata-delete-failed',
      assetId: input.assetId,
      message: '写真情報を削除できませんでした。画像データは変更されていません。',
      cause: error,
      retryable: true,
    });
  }

  try {
    await dependencies.mediaAssetBlobs.deleteByAssetId(input.assetId);
  } catch (error) {
    throw new MediaAssetDeletionError({
      code: 'blob-delete-failed',
      assetId: input.assetId,
      message: '写真情報は削除済みですが、画像データの削除を完了できませんでした。もう一度お試しください。',
      cause: error,
      metadataDeleted: true,
      retryable: true,
    });
  }

  return {
    assetId: input.assetId,
    tripId: asset?.tripId,
    usage: asset?.usage,
    metadataWasPresent: Boolean(asset),
    metadataDeleted: true,
    blobsDeleted: true,
    removeFromLists: true,
  };
}
