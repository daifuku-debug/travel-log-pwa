import type { CastleVisitEvent, CastleVisitSummary } from '../../domain/models/castle';
import type { Collection, CollectionItem, CollectionVisit } from '../../domain/models/collection';
import type { PrefectureVisit, TripPrefectureVisit } from '../../domain/models/japanConquest';
import type {
  RpgExperienceEntry,
  RpgQuest,
  RpgSettings,
  TripRpgResult,
  UserRpgAchievement,
  UserRpgTitle,
} from '../../domain/models/rpg';
import type { MediaAsset, Scrapbook, ScrapbookBlock, ScrapbookPage } from '../../domain/models/scrapbook';
import type { ManualTimelineEntry } from '../../domain/models/timeMachine';
import type { TravelGachaDraw } from '../../domain/models/travelGacha';
import type { PlaceVisit, Trip, TripTransportLeg } from '../../domain/models/trip';
import type { WishlistItem } from '../../domain/models/wishlist';
import { clearStore, putMany, readStoresSnapshot, type StoreName } from '../../infrastructure/localDb/db.ts';
import { toAppError } from '../../shared/errors.ts';
import { BACKUP_SCHEMA_VERSION, normalizeBackupPayload, type TravelLogBackup } from './backupSchema.ts';

export async function buildBackupPayload(): Promise<TravelLogBackup> {
  try {
    return buildBackupPayloadFromSnapshot(await readBackupSnapshot());
  } catch (error) {
    throw toAppError(error, 'バックアップの作成に失敗しました');
  }
}

export const BACKUP_METADATA_STORE_NAMES = [
  'trips',
  'placeVisits',
  'tripTransportLegs',
  'wishlistItems',
  'collections',
  'collectionItems',
  'collectionVisits',
  'prefectureVisits',
  'tripPrefectureVisits',
  'castleVisitSummaries',
  'castleVisitEvents',
  'scrapbooks',
  'scrapbookPages',
  'scrapbookBlocks',
  'mediaAssets',
  'manualTimelineEntries',
  'travelGachaDraws',
  'rpgExperienceEntries',
  'userRpgTitles',
  'userRpgAchievements',
  'rpgQuests',
  'tripRpgResults',
  'rpgSettings',
] as const satisfies readonly StoreName[];

export type BackupSnapshot = Partial<Record<StoreName, unknown[]>>;

export async function readBackupSnapshot(includeMediaBlobs = false): Promise<BackupSnapshot> {
  return readStoresSnapshot(includeMediaBlobs
    ? [...BACKUP_METADATA_STORE_NAMES, 'mediaAssetBlobs']
    : BACKUP_METADATA_STORE_NAMES);
}

export function buildBackupPayloadFromSnapshot(
  snapshot: BackupSnapshot,
  exportedAt = new Date().toISOString(),
): TravelLogBackup {
  return normalizeBackupPayload({
    app: 'travel-log-pwa',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: {
      trips: snapshot.trips as Trip[] | undefined,
      placeVisits: snapshot.placeVisits as PlaceVisit[] | undefined,
      tripTransportLegs: snapshot.tripTransportLegs as TripTransportLeg[] | undefined,
      wishlistItems: snapshot.wishlistItems as WishlistItem[] | undefined,
      collections: snapshot.collections as Collection[] | undefined,
      collectionItems: snapshot.collectionItems as CollectionItem[] | undefined,
      collectionVisits: snapshot.collectionVisits as CollectionVisit[] | undefined,
      prefectureVisits: snapshot.prefectureVisits as PrefectureVisit[] | undefined,
      tripPrefectureVisits: snapshot.tripPrefectureVisits as TripPrefectureVisit[] | undefined,
      castleVisitSummaries: snapshot.castleVisitSummaries as CastleVisitSummary[] | undefined,
      castleVisitEvents: snapshot.castleVisitEvents as CastleVisitEvent[] | undefined,
      scrapbooks: snapshot.scrapbooks as Scrapbook[] | undefined,
      scrapbookPages: snapshot.scrapbookPages as ScrapbookPage[] | undefined,
      scrapbookBlocks: snapshot.scrapbookBlocks as ScrapbookBlock[] | undefined,
      mediaAssets: snapshot.mediaAssets as MediaAsset[] | undefined,
      manualTimelineEntries: snapshot.manualTimelineEntries as ManualTimelineEntry[] | undefined,
      travelGachaDraws: snapshot.travelGachaDraws as TravelGachaDraw[] | undefined,
      rpgExperienceEntries: snapshot.rpgExperienceEntries as RpgExperienceEntry[] | undefined,
      userRpgTitles: snapshot.userRpgTitles as UserRpgTitle[] | undefined,
      userRpgAchievements: snapshot.userRpgAchievements as UserRpgAchievement[] | undefined,
      rpgQuests: snapshot.rpgQuests as RpgQuest[] | undefined,
      tripRpgResults: snapshot.tripRpgResults as TripRpgResult[] | undefined,
      rpgSettings: snapshot.rpgSettings as RpgSettings[] | undefined,
    },
  });
}

export async function restoreBackupPayload(payload: unknown): Promise<void> {
  try {
    const normalized = normalizeBackupPayload(payload);
    await Promise.all([
      clearStore('trips'),
      clearStore('placeVisits'),
      clearStore('tripTransportLegs'),
      clearStore('wishlistItems'),
      clearStore('collections'),
      clearStore('collectionItems'),
      clearStore('collectionVisits'),
      clearStore('prefectureVisits'),
      clearStore('tripPrefectureVisits'),
      clearStore('castleVisitSummaries'),
      clearStore('castleVisitEvents'),
      clearStore('scrapbooks'),
      clearStore('scrapbookPages'),
      clearStore('scrapbookBlocks'),
      clearStore('mediaAssets'),
      clearStore('manualTimelineEntries'),
      clearStore('travelGachaDraws'),
      clearStore('rpgExperienceEntries'),
      clearStore('userRpgTitles'),
      clearStore('userRpgAchievements'),
      clearStore('rpgQuests'),
      clearStore('tripRpgResults'),
      clearStore('rpgSettings'),
    ]);

    await Promise.all([
      putMany('trips', normalized.data.trips),
      putMany('placeVisits', normalized.data.placeVisits),
      putMany('tripTransportLegs', normalized.data.tripTransportLegs),
      putMany('wishlistItems', normalized.data.wishlistItems),
      putMany('collections', normalized.data.collections),
      putMany('collectionItems', normalized.data.collectionItems),
      putMany('collectionVisits', normalized.data.collectionVisits),
      putMany('prefectureVisits', normalized.data.prefectureVisits),
      putMany('tripPrefectureVisits', normalized.data.tripPrefectureVisits),
      putMany('castleVisitSummaries', normalized.data.castleVisitSummaries),
      putMany('castleVisitEvents', normalized.data.castleVisitEvents),
      putMany('scrapbooks', normalized.data.scrapbooks),
      putMany('scrapbookPages', normalized.data.scrapbookPages),
      putMany('scrapbookBlocks', normalized.data.scrapbookBlocks),
      putMany('mediaAssets', normalized.data.mediaAssets),
      putMany('manualTimelineEntries', normalized.data.manualTimelineEntries),
      putMany('travelGachaDraws', normalized.data.travelGachaDraws),
      putMany('rpgExperienceEntries', normalized.data.rpgExperienceEntries),
      putMany('userRpgTitles', normalized.data.userRpgTitles),
      putMany('userRpgAchievements', normalized.data.userRpgAchievements),
      putMany('rpgQuests', normalized.data.rpgQuests),
      putMany('tripRpgResults', normalized.data.tripRpgResults),
      putMany('rpgSettings', normalized.data.rpgSettings),
    ]);
  } catch (error) {
    throw toAppError(error, 'バックアップの復元に失敗しました');
  }
}
