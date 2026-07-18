import type { Collection, CollectionItem, CollectionVisit } from '../../domain/models/collection';
import type { PrefectureVisit, TripPrefectureVisit } from '../../domain/models/japanConquest';
import type { PlaceVisit, Trip } from '../../domain/models/trip';
import type { WishlistItem } from '../../domain/models/wishlist';

export const BACKUP_SCHEMA_VERSION = 2;

export interface TravelLogBackup {
  app: 'travel-log-pwa';
  schemaVersion: number;
  exportedAt: string;
  data: {
    trips: Trip[];
    placeVisits: PlaceVisit[];
    wishlistItems: WishlistItem[];
    collections: Collection[];
    collectionItems: CollectionItem[];
    collectionVisits: CollectionVisit[];
    prefectureVisits: PrefectureVisit[];
    tripPrefectureVisits: TripPrefectureVisit[];
  };
}

export function normalizeBackupPayload(payload: unknown): TravelLogBackup {
  if (isObject(payload) && payload.app === 'travel-log-pwa' && isObject(payload.data)) {
    const data = payload.data as Record<string, unknown>;
    return {
      app: 'travel-log-pwa',
      schemaVersion: typeof payload.schemaVersion === 'number' ? payload.schemaVersion : 1,
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : new Date().toISOString(),
      data: {
        trips: arrayOrEmpty<Trip>(data.trips),
        placeVisits: arrayOrEmpty<PlaceVisit>(data.placeVisits),
        wishlistItems: arrayOrEmpty<WishlistItem>(data.wishlistItems),
        collections: arrayOrEmpty<Collection>(data.collections),
        collectionItems: arrayOrEmpty<CollectionItem>(data.collectionItems),
        collectionVisits: arrayOrEmpty<CollectionVisit>(data.collectionVisits),
        prefectureVisits: arrayOrEmpty<PrefectureVisit>(data.prefectureVisits),
        tripPrefectureVisits: arrayOrEmpty<TripPrefectureVisit>(data.tripPrefectureVisits),
      },
    };
  }

  if (Array.isArray(payload)) {
    return emptyBackup({ trips: payload as Trip[] });
  }

  if (isObject(payload)) {
    const data = payload as Record<string, unknown>;
    return emptyBackup({
      trips: arrayOrEmpty<Trip>(data.trips),
      placeVisits: arrayOrEmpty<PlaceVisit>(data.placeVisits),
      wishlistItems: arrayOrEmpty<WishlistItem>(data.wishlistItems),
      collections: arrayOrEmpty<Collection>(data.collections),
      collectionItems: arrayOrEmpty<CollectionItem>(data.collectionItems),
      collectionVisits: arrayOrEmpty<CollectionVisit>(data.collectionVisits),
      prefectureVisits: arrayOrEmpty<PrefectureVisit>(data.prefectureVisits),
      tripPrefectureVisits: arrayOrEmpty<TripPrefectureVisit>(data.tripPrefectureVisits),
    });
  }

  throw new Error('バックアップ形式が不正です。');
}

function emptyBackup(data: Partial<TravelLogBackup['data']>): TravelLogBackup {
  return {
    app: 'travel-log-pwa',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      trips: data.trips ?? [],
      placeVisits: data.placeVisits ?? [],
      wishlistItems: data.wishlistItems ?? [],
      collections: data.collections ?? [],
      collectionItems: data.collectionItems ?? [],
      collectionVisits: data.collectionVisits ?? [],
      prefectureVisits: data.prefectureVisits ?? [],
      tripPrefectureVisits: data.tripPrefectureVisits ?? [],
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
