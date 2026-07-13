import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { bootstrapAppData } from '../bootstrap/bootstrapService';

export async function listCollectionsWithProgress() {
  try {
    await bootstrapAppData();
    return repositories.collections.listWithProgress();
  } catch (error) {
    throw toAppError(error, 'コレクションの読み込みに失敗しました');
  }
}
