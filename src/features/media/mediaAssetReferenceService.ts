import { repositories } from '../../infrastructure/repositories/repositoryFactory.ts';
import type { MediaAssetReference } from '../../domain/media/mediaAssetReferences.ts';
import {
  findMediaAssetReferencesWithDependencies,
  type FindMediaAssetReferencesInput,
} from './mediaAssetReferenceLogic.ts';

export type {
  FindMediaAssetReferencesInput,
  MediaAssetReferenceDependencies,
} from './mediaAssetReferenceLogic.ts';

export async function findMediaAssetReferences(
  input: FindMediaAssetReferencesInput,
): Promise<MediaAssetReference[]> {
  return findMediaAssetReferencesWithDependencies(input, repositories);
}
