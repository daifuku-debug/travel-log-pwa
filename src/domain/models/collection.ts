import type { BaseEntity, EntityId, IsoDateTimeString } from './common';

export type CollectionCategory = 'castle' | 'station' | 'worldHeritage' | 'custom';

export interface Collection extends BaseEntity {
  name: string;
  category: CollectionCategory;
  description?: string;
}

export interface CollectionItem extends BaseEntity {
  collectionId: EntityId;
  name: string;
  prefecture?: string;
  country?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  officialUrl?: string;
  memo?: string;
}

export interface CollectionVisit extends BaseEntity {
  collectionItemId: EntityId;
  tripId?: EntityId;
  placeVisitId?: EntityId;
  visitedAt: IsoDateTimeString;
  memo?: string;
}
