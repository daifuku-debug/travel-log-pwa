import type { EntityId } from '../../domain/models/common';
import type { MediaAsset } from '../../domain/models/scrapbook';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { persistPreparedTripMediaAsset } from './mediaAssetPersistence';
import {
  prepareMediaImage,
  type MediaImageProcessor,
  type PreparedMediaImage,
} from './mediaAssetValidation';

export {
  MAX_MEDIA_FILE_BYTES,
  prepareMediaImage,
  resolveImageMimeType,
  validateImageFile,
} from './mediaAssetValidation';
export type { MediaImageProcessor, PreparedMediaImage } from './mediaAssetValidation';
export { MediaAssetSaveError } from './mediaAssetPersistence';

export async function savePreparedTripMediaAsset(tripId: EntityId, prepared: PreparedMediaImage): Promise<MediaAsset> {
  return persistPreparedTripMediaAsset(tripId, prepared, repositories);
}

export async function saveTripMediaAsset(
  tripId: EntityId,
  file: File,
  processor?: MediaImageProcessor,
): Promise<MediaAsset> {
  const prepared = processor ? await prepareMediaImage(file, processor) : await prepareMediaImage(file);
  return savePreparedTripMediaAsset(tripId, prepared);
}
