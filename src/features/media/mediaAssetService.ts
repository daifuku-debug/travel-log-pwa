import type { EntityId } from '../../domain/models/common';
import type { MediaAsset } from '../../domain/models/scrapbook';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { persistPreparedTripMediaAsset, type SaveMediaAssetOptions } from './mediaAssetPersistence';
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
export type { SaveMediaAssetOptions } from './mediaAssetPersistence';
export { MediaAssetSaveError } from './mediaAssetPersistence';

export async function savePreparedTripMediaAsset(
  tripId: EntityId,
  prepared: PreparedMediaImage,
  options?: SaveMediaAssetOptions,
): Promise<MediaAsset> {
  return persistPreparedTripMediaAsset(tripId, prepared, repositories, options);
}

export async function saveTripMediaAsset(
  tripId: EntityId,
  file: File,
  processor?: MediaImageProcessor,
  options?: SaveMediaAssetOptions,
): Promise<MediaAsset> {
  const prepared = processor ? await prepareMediaImage(file, processor) : await prepareMediaImage(file);
  return savePreparedTripMediaAsset(tripId, prepared, options);
}
