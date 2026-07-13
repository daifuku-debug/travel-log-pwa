import type { EntityId } from '../models/common';
import type { Collection, CollectionItem, CollectionVisit } from '../models/collection';
import type { BaseRepository } from './BaseRepository';

export interface CollectionRepository extends BaseRepository<Collection> {
  listWithProgress(): Promise<Array<Collection & { totalCount: number; visitedCount: number }>>;
}

export interface CollectionItemRepository extends BaseRepository<CollectionItem> {
  listByCollectionId(collectionId: EntityId): Promise<CollectionItem[]>;
}

export interface CollectionVisitRepository extends BaseRepository<CollectionVisit> {
  listByCollectionItemId(collectionItemId: EntityId): Promise<CollectionVisit[]>;
}
