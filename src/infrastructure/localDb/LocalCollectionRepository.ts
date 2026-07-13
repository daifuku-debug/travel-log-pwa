import type { EntityId } from '../../domain/models/common';
import type { Collection, CollectionItem, CollectionVisit } from '../../domain/models/collection';
import type {
  CollectionItemRepository,
  CollectionRepository,
  CollectionVisitRepository,
} from '../../domain/repositories/CollectionRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalCollectionRepository
  extends LocalBaseRepository<Collection>
  implements CollectionRepository
{
  constructor(
    private readonly itemRepository: CollectionItemRepository,
    private readonly visitRepository: CollectionVisitRepository,
  ) {
    super('collections');
  }

  async listWithProgress(): Promise<Array<Collection & { totalCount: number; visitedCount: number }>> {
    const collections = await this.list();
    return Promise.all(
      collections.map(async (collection) => {
        const items = await this.itemRepository.listByCollectionId(collection.id);
        const visitedFlags = await Promise.all(
          items.map(async (item) => {
            const visits = await this.visitRepository.listByCollectionItemId(item.id);
            return visits.length > 0;
          }),
        );
        return {
          ...collection,
          totalCount: items.length,
          visitedCount: visitedFlags.filter(Boolean).length,
        };
      }),
    );
  }
}

export class LocalCollectionItemRepository
  extends LocalBaseRepository<CollectionItem>
  implements CollectionItemRepository
{
  constructor() {
    super('collectionItems');
  }

  async listByCollectionId(collectionId: EntityId): Promise<CollectionItem[]> {
    const items = await this.list();
    return items.filter((item) => item.collectionId === collectionId);
  }
}

export class LocalCollectionVisitRepository
  extends LocalBaseRepository<CollectionVisit>
  implements CollectionVisitRepository
{
  constructor() {
    super('collectionVisits');
  }

  async listByCollectionItemId(collectionItemId: EntityId): Promise<CollectionVisit[]> {
    const visits = await this.list();
    return visits.filter((visit) => visit.collectionItemId === collectionItemId);
  }
}
