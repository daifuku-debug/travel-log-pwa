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

export async function listCollectionDetails() {
  try {
    await bootstrapAppData();
    const collections = await repositories.collections.listWithProgress();
    return Promise.all(
      collections.map(async (collection) => {
        const items = await repositories.collectionItems.listByCollectionId(collection.id);
        const itemDetails = await Promise.all(
          items.map(async (item) => {
            const visits = await repositories.collectionVisits.listByCollectionItemId(item.id);
            return {
              item,
              visits,
              isVisited: visits.length > 0,
              lastVisitedAt: visits
                .slice()
                .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))[0]?.visitedAt,
            };
          }),
        );
        return {
          ...collection,
          items: itemDetails.sort((a, b) => a.item.name.localeCompare(b.item.name, 'ja')),
        };
      }),
    );
  } catch (error) {
    throw toAppError(error, 'コレクション内訳の読み込みに失敗しました');
  }
}
