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
import { clearStore, putMany, readAll } from '../../infrastructure/localDb/db';
import { toAppError } from '../../shared/errors';
import { BACKUP_SCHEMA_VERSION, normalizeBackupPayload, type TravelLogBackup } from './backupSchema';

export async function buildBackupPayload(): Promise<TravelLogBackup> {
  try {
    const [
      trips,
      placeVisits,
      tripTransportLegs,
      wishlistItems,
      collections,
      collectionItems,
      collectionVisits,
      prefectureVisits,
      tripPrefectureVisits,
      castleVisitSummaries,
      castleVisitEvents,
      scrapbooks,
      scrapbookPages,
      scrapbookBlocks,
      mediaAssets,
      manualTimelineEntries,
      travelGachaDraws,
      rpgExperienceEntries,
      userRpgTitles,
      userRpgAchievements,
      rpgQuests,
      tripRpgResults,
      rpgSettings,
    ] = await Promise.all([
      readAll<Trip>('trips'),
      readAll<PlaceVisit>('placeVisits'),
      readAll<TripTransportLeg>('tripTransportLegs'),
      readAll<WishlistItem>('wishlistItems'),
      readAll<Collection>('collections'),
      readAll<CollectionItem>('collectionItems'),
      readAll<CollectionVisit>('collectionVisits'),
      readAll<PrefectureVisit>('prefectureVisits'),
      readAll<TripPrefectureVisit>('tripPrefectureVisits'),
      readAll<CastleVisitSummary>('castleVisitSummaries'),
      readAll<CastleVisitEvent>('castleVisitEvents'),
      readAll<Scrapbook>('scrapbooks'),
      readAll<ScrapbookPage>('scrapbookPages'),
      readAll<ScrapbookBlock>('scrapbookBlocks'),
      readAll<MediaAsset>('mediaAssets'),
      readAll<ManualTimelineEntry>('manualTimelineEntries'),
      readAll<TravelGachaDraw>('travelGachaDraws'),
      readAll<RpgExperienceEntry>('rpgExperienceEntries'),
      readAll<UserRpgTitle>('userRpgTitles'),
      readAll<UserRpgAchievement>('userRpgAchievements'),
      readAll<RpgQuest>('rpgQuests'),
      readAll<TripRpgResult>('tripRpgResults'),
      readAll<RpgSettings>('rpgSettings'),
    ]);

    return normalizeBackupPayload({
      app: 'travel-log-pwa',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        trips,
        placeVisits,
        tripTransportLegs,
        wishlistItems,
        collections,
        collectionItems,
        collectionVisits,
        prefectureVisits,
        tripPrefectureVisits,
        castleVisitSummaries,
        castleVisitEvents,
        scrapbooks,
        scrapbookPages,
        scrapbookBlocks,
        mediaAssets,
        manualTimelineEntries,
        travelGachaDraws,
        rpgExperienceEntries,
        userRpgTitles,
        userRpgAchievements,
        rpgQuests,
        tripRpgResults,
        rpgSettings,
      },
    });
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
