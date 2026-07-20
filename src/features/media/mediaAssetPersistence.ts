import type { EntityId } from '../../domain/models/common.ts';
import type { MediaAsset, MediaAssetUsage } from '../../domain/models/scrapbook.ts';
import { normalizeMediaAssetOwnership } from '../../domain/media/mediaAssetUsage.ts';
import type { MediaAssetBlobRepository, MediaAssetRepository } from '../../domain/repositories/ScrapbookRepository.ts';
import { AppError } from '../../shared/errors.ts';
import { createId } from '../../shared/id.ts';
import type { PreparedMediaImage } from './mediaAssetValidation.ts';

const LOCAL_USER_ID = 'local-user';

export interface MediaAssetPersistence {
  mediaAssets: MediaAssetRepository;
  mediaAssetBlobs: MediaAssetBlobRepository;
}

export interface SaveMediaAssetOptions {
  usage?: MediaAssetUsage;
  ownerScrapbookId?: EntityId;
}

export class MediaAssetSaveError extends AppError {
  readonly cleanupErrors: unknown[];

  constructor(message: string, cause?: unknown, cleanupErrors: unknown[] = []) {
    super(message, cause);
    this.name = 'MediaAssetSaveError';
    this.cleanupErrors = cleanupErrors;
  }
}

export async function persistPreparedTripMediaAsset(
  tripId: EntityId,
  prepared: PreparedMediaImage,
  persistence: MediaAssetPersistence,
  options: SaveMediaAssetOptions = {},
): Promise<MediaAsset> {
  const usage = options.usage ?? 'trip';
  if (usage === 'cover-only' && !options.ownerScrapbookId?.trim()) {
    throw new AppError('表紙専用写真には所有するスクラップブックが必要です。');
  }
  const now = new Date().toISOString();
  const assetId = createId('media-asset');
  const originalBlobId = `${assetId}:original`;
  const thumbnailBlobId = `${assetId}:thumbnail`;
  let originalBlobSaved = false;
  let metadataSaveStarted = false;

  try {
    await persistence.mediaAssetBlobs.save({
      id: originalBlobId,
      assetId,
      kind: 'original',
      blob: prepared.file,
      mimeType: prepared.mimeType,
      createdAt: now,
    });
    originalBlobSaved = true;
    await persistence.mediaAssetBlobs.save({
      id: thumbnailBlobId,
      assetId,
      kind: 'thumbnail',
      blob: prepared.thumbnailBlob,
      mimeType: prepared.thumbnailBlob.type || prepared.mimeType,
      createdAt: now,
    });

    metadataSaveStarted = true;
    return await persistence.mediaAssets.save(normalizeMediaAssetOwnership({
      id: assetId,
      userId: LOCAL_USER_ID,
      tripId,
      usage,
      ownerScrapbookId: options.ownerScrapbookId,
      storageType: 'local',
      localReference: originalBlobId,
      thumbnailReference: thumbnailBlobId,
      mimeType: prepared.mimeType,
      width: prepared.width,
      height: prepared.height,
      fileSize: prepared.file.size,
      originalFileName: prepared.file.name,
      mediaSyncStatus: 'local_only',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }));
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    if (originalBlobSaved) {
      try {
        await persistence.mediaAssetBlobs.deleteByAssetId(assetId);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (metadataSaveStarted) {
      try {
        await persistence.mediaAssets.softDelete(assetId);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    throw new MediaAssetSaveError('写真を端末に保存できませんでした。空き容量を確認して、もう一度お試しください。', error, cleanupErrors);
  }
}
