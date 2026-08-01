import {
  detachMediaAssetFromBlock,
  detachMediaAssetFromScrapbook,
  groupMediaAssetReferences,
  type MediaAssetReferenceGroup,
} from '../../domain/media/mediaAssetReferenceDetachment.ts';
import type { MediaAssetReference } from '../../domain/media/mediaAssetReferences.ts';
import type { EntityId } from '../../domain/models/common.ts';
import type { Scrapbook, ScrapbookBlock } from '../../domain/models/scrapbook.ts';
import type {
  ScrapbookBlockRepository,
  ScrapbookRepository,
} from '../../domain/repositories/ScrapbookRepository.ts';
import { AppError } from '../../shared/errors.ts';
import type { FindMediaAssetReferencesInput } from './mediaAssetReferenceLogic.ts';

export type MediaAssetReferenceDetachmentErrorCode =
  | 'transient-reference'
  | 'no-selection'
  | 'reference-search-failed'
  | 'unsupported-reference'
  | 'entity-read-failed'
  | 'update-failed'
  | 'postcheck-failed';

export interface DetachMediaAssetReferencesInput {
  assetId: EntityId;
  tripId: EntityId;
  selectedGroupKeys: readonly string[];
  protectedAssetIds?: readonly EntityId[];
}

export interface DetachMediaAssetReferencesResult {
  assetId: EntityId;
  updatedGroupKeys: string[];
  remainingReferences: MediaAssetReference[];
  remainingGroups: MediaAssetReferenceGroup[];
  detachedCover: boolean;
  canDelete: boolean;
}

export interface MediaAssetReferenceDetachmentDependencies {
  scrapbooks: Pick<ScrapbookRepository, 'getById' | 'save'>;
  scrapbookBlocks: Pick<ScrapbookBlockRepository, 'getById' | 'save'>;
  findReferences: (input: FindMediaAssetReferencesInput) => Promise<MediaAssetReference[]>;
  now?: () => string;
}

export class MediaAssetReferenceDetachmentError extends AppError {
  readonly code: MediaAssetReferenceDetachmentErrorCode;
  readonly assetId: EntityId;
  readonly updatedGroupKeys: string[];
  readonly retryable: boolean;

  constructor({
    code,
    assetId,
    message,
    cause,
    updatedGroupKeys = [],
    retryable = false,
  }: {
    code: MediaAssetReferenceDetachmentErrorCode;
    assetId: EntityId;
    message: string;
    cause?: unknown;
    updatedGroupKeys?: string[];
    retryable?: boolean;
  }) {
    super(message, cause);
    this.name = 'MediaAssetReferenceDetachmentError';
    this.code = code;
    this.assetId = assetId;
    this.updatedGroupKeys = updatedGroupKeys;
    this.retryable = retryable;
  }
}

export async function detachMediaAssetReferencesWithDependencies(
  input: DetachMediaAssetReferencesInput,
  dependencies: MediaAssetReferenceDetachmentDependencies,
): Promise<DetachMediaAssetReferencesResult> {
  if (input.protectedAssetIds?.includes(input.assetId)) {
    throw createError('transient-reference', input, '編集中の表紙で選択している写真の参照は解除できません。');
  }
  if (input.selectedGroupKeys.length === 0) {
    throw createError('no-selection', input, '解除する参照を選択してください。');
  }

  const references = await findReferencesSafely(input, dependencies, 'reference-search-failed');
  const groups = groupMediaAssetReferences(references);
  const selectedKeySet = new Set(input.selectedGroupKeys);
  const initiallySelectedGroups = groups.filter((group) => selectedKeySet.has(group.key));
  const unsupported = initiallySelectedGroups.find((group) => !group.detachable);
  if (unsupported) {
    throw createError('unsupported-reference', input, '先に対象ページを編集する必要がある参照は解除できません。');
  }

  // The confirmation screen may be stale. Re-read immediately before loading
  // and updating entities so newly unsupported references are never changed.
  const executionReferences = await findReferencesSafely(input, dependencies, 'reference-search-failed');
  const selectedGroups = groupMediaAssetReferences(executionReferences)
    .filter((group) => selectedKeySet.has(group.key));
  if (selectedGroups.some((group) => !group.detachable)) {
    throw createError('unsupported-reference', input, '参照状態が変わったため、使用状況を確認し直してください。');
  }

  const scrapbookGroups = groupBy(selectedGroups.filter((group) => (
    group.kind === 'cover' || group.kind === 'highlight'
  )), (group) => group.scrapbookId);
  const blockGroups = groupBy(selectedGroups.filter((group) => group.blockId), (group) => group.blockId!);
  const scrapbookUpdates: Array<{ entity: Scrapbook; groupKeys: string[] }> = [];
  const blockUpdates: Array<{ entity: ScrapbookBlock; groupKeys: string[] }> = [];
  const now = (dependencies.now ?? (() => new Date().toISOString()))();

  try {
    for (const [scrapbookId, targetGroups] of scrapbookGroups) {
      const current = await dependencies.scrapbooks.getById(scrapbookId);
      if (!current) throw new Error(`scrapbook:${scrapbookId}`);
      const selectedKinds = new Set(targetGroups.map((group) => group.kind).filter((kind): kind is 'cover' | 'highlight' => (
        kind === 'cover' || kind === 'highlight'
      )));
      const entity = detachMediaAssetFromScrapbook(current, input.assetId, selectedKinds, now);
      if (entity !== current) scrapbookUpdates.push({ entity, groupKeys: targetGroups.map((group) => group.key) });
    }
    for (const [blockId, targetGroups] of blockGroups) {
      const current = await dependencies.scrapbookBlocks.getById(blockId);
      if (!current) throw new Error(`block:${blockId}`);
      const entity = detachMediaAssetFromBlock(current, input.assetId, now);
      if (!entity) throw new Error(`unsupported-block:${blockId}`);
      if (entity !== current) blockUpdates.push({ entity, groupKeys: targetGroups.map((group) => group.key) });
    }
  } catch (error) {
    throw createError('entity-read-failed', input, '解除対象の最新データを確認できなかったため、変更しませんでした。', error, [], true);
  }

  const updatedGroupKeys: string[] = [];
  try {
    for (const update of scrapbookUpdates) {
      await dependencies.scrapbooks.save(update.entity);
      updatedGroupKeys.push(...update.groupKeys);
    }
    for (const update of blockUpdates) {
      await dependencies.scrapbookBlocks.save(update.entity);
      updatedGroupKeys.push(...update.groupKeys);
    }
  } catch (error) {
    throw createError(
      'update-failed',
      input,
      updatedGroupKeys.length > 0
        ? '一部の参照だけ解除されました。写真は削除していません。使用状況を再確認して、もう一度お試しください。'
        : '参照を解除できませんでした。写真は削除していません。',
      error,
      updatedGroupKeys,
      true,
    );
  }

  const remainingReferences = await findReferencesSafely(input, dependencies, 'postcheck-failed', updatedGroupKeys);
  return {
    assetId: input.assetId,
    updatedGroupKeys,
    remainingReferences,
    remainingGroups: groupMediaAssetReferences(remainingReferences),
    detachedCover: updatedGroupKeys.some((key) => key.endsWith(':cover')),
    canDelete: remainingReferences.length === 0,
  };
}

async function findReferencesSafely(
  input: DetachMediaAssetReferencesInput,
  dependencies: MediaAssetReferenceDetachmentDependencies,
  code: 'reference-search-failed' | 'postcheck-failed',
  updatedGroupKeys: string[] = [],
): Promise<MediaAssetReference[]> {
  try {
    return await dependencies.findReferences({ assetId: input.assetId, tripId: input.tripId });
  } catch (error) {
    throw createError(
      code,
      input,
      code === 'postcheck-failed'
        ? '参照解除後の使用状況を確認できませんでした。写真は削除していません。'
        : '写真の使用状況を確認できなかったため、変更しませんでした。',
      error,
      updatedGroupKeys,
      true,
    );
  }
}

function createError(
  code: MediaAssetReferenceDetachmentErrorCode,
  input: DetachMediaAssetReferencesInput,
  message: string,
  cause?: unknown,
  updatedGroupKeys: string[] = [],
  retryable = false,
): MediaAssetReferenceDetachmentError {
  return new MediaAssetReferenceDetachmentError({
    code,
    assetId: input.assetId,
    message,
    cause,
    updatedGroupKeys,
    retryable,
  });
}

function groupBy<T>(values: T[], getKey: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    result.set(key, [...(result.get(key) ?? []), value]);
  }
  return result;
}
