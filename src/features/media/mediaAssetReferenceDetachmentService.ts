import { repositories } from '../../infrastructure/repositories/repositoryFactory.ts';
import {
  detachMediaAssetReferencesWithDependencies,
  type DetachMediaAssetReferencesInput,
  type DetachMediaAssetReferencesResult,
} from './mediaAssetReferenceDetachmentLogic.ts';
import { findMediaAssetReferences } from './mediaAssetReferenceService.ts';

export {
  MediaAssetReferenceDetachmentError,
  type DetachMediaAssetReferencesInput,
  type DetachMediaAssetReferencesResult,
  type MediaAssetReferenceDetachmentErrorCode,
} from './mediaAssetReferenceDetachmentLogic.ts';

export async function detachMediaAssetReferences(
  input: DetachMediaAssetReferencesInput,
): Promise<DetachMediaAssetReferencesResult> {
  return detachMediaAssetReferencesWithDependencies(input, {
    scrapbooks: repositories.scrapbooks,
    scrapbookBlocks: repositories.scrapbookBlocks,
    findReferences: findMediaAssetReferences,
  });
}
