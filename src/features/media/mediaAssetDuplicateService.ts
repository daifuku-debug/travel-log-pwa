import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import {
  findExactDuplicateMediaAssetsWithDependencies,
  type ExactDuplicateMatch,
  type FindExactDuplicateMediaAssetsInput,
} from './mediaAssetDuplicateLogic';

export type {
  ExactDuplicateFileInfo,
  ExactDuplicateMatch,
  FindExactDuplicateMediaAssetsInput,
} from './mediaAssetDuplicateLogic';

export async function findExactDuplicateMediaAssets(
  input: FindExactDuplicateMediaAssetsInput,
): Promise<ExactDuplicateMatch[]> {
  return findExactDuplicateMediaAssetsWithDependencies(input, repositories);
}
