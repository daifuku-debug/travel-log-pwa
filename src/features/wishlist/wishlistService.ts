import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { bootstrapAppData } from '../bootstrap/bootstrapService';

export async function listWishlistItems() {
  try {
    await bootstrapAppData();
    return repositories.wishlist.list();
  } catch (error) {
    throw toAppError(error, '欲しいものメモの読み込みに失敗しました');
  }
}
