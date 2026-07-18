import type { Collection, CollectionItem, CollectionVisit } from '../../domain/models/collection';
import type { PrefectureVisit, TripPrefectureVisit } from '../../domain/models/japanConquest';
import type { PlaceVisit, Trip } from '../../domain/models/trip';
import type { WishlistItem } from '../../domain/models/wishlist';
import { clearStore, putMany, readAll } from '../../infrastructure/localDb/db';
import { toAppError } from '../../shared/errors';
import { BACKUP_SCHEMA_VERSION, normalizeBackupPayload, type TravelLogBackup } from './backupSchema';

export async function buildBackupPayload(): Promise<TravelLogBackup> {
  try {
    const [
      trips,
      placeVisits,
      wishlistItems,
      collections,
      collectionItems,
      collectionVisits,
      prefectureVisits,
      tripPrefectureVisits,
    ] = await Promise.all([
      readAll<Trip>('trips'),
      readAll<PlaceVisit>('placeVisits'),
      readAll<WishlistItem>('wishlistItems'),
      readAll<Collection>('collections'),
      readAll<CollectionItem>('collectionItems'),
      readAll<CollectionVisit>('collectionVisits'),
      readAll<PrefectureVisit>('prefectureVisits'),
      readAll<TripPrefectureVisit>('tripPrefectureVisits'),
    ]);

    return {
      app: 'travel-log-pwa',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        trips,
        placeVisits,
        wishlistItems,
        collections,
        collectionItems,
        collectionVisits,
        prefectureVisits,
        tripPrefectureVisits,
      },
    };
  } catch (error) {
    throw toAppError(error, 'バックアップの作成に失敗しました');
  }
}

export async function restoreBackupPayload(payload: unknown): Promise<void> {
  try {
    const normalized = normalizeBackupPayload(payload);
    await Promise.all([
      clearStore('trips'),
      clearStore('placeVisits'),
      clearStore('wishlistItems'),
      clearStore('collections'),
      clearStore('collectionItems'),
      clearStore('collectionVisits'),
      clearStore('prefectureVisits'),
      clearStore('tripPrefectureVisits'),
    ]);

    await Promise.all([
      putMany('trips', normalized.data.trips),
      putMany('placeVisits', normalized.data.placeVisits),
      putMany('wishlistItems', normalized.data.wishlistItems),
      putMany('collections', normalized.data.collections),
      putMany('collectionItems', normalized.data.collectionItems),
      putMany('collectionVisits', normalized.data.collectionVisits),
      putMany('prefectureVisits', normalized.data.prefectureVisits),
      putMany('tripPrefectureVisits', normalized.data.tripPrefectureVisits),
    ]);
  } catch (error) {
    throw toAppError(error, 'バックアップの復元に失敗しました');
  }
}
