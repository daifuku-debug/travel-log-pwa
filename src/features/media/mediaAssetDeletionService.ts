import { repositories } from '../../infrastructure/repositories/repositoryFactory.ts';
import {
  deleteUnreferencedMediaAssetWithDependencies,
  type DeleteUnreferencedMediaAssetInput,
  type DeleteUnreferencedMediaAssetResult,
} from './mediaAssetDeletionLogic.ts';
import { findMediaAssetReferences } from './mediaAssetReferenceService.ts';

export {
  MediaAssetDeletionError,
  type DeleteUnreferencedMediaAssetInput,
  type DeleteUnreferencedMediaAssetResult,
  type MediaAssetDeletionErrorCode,
} from './mediaAssetDeletionLogic.ts';

export async function deleteUnreferencedMediaAsset(
  input: DeleteUnreferencedMediaAssetInput,
): Promise<DeleteUnreferencedMediaAssetResult> {
  return deleteUnreferencedMediaAssetWithDependencies(input, {
    mediaAssets: repositories.mediaAssets,
    mediaAssetBlobs: repositories.mediaAssetBlobs,
    findReferences: findMediaAssetReferences,
  });
}
