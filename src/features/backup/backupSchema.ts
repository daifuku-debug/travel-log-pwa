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
import {
  migrateScrapbookBlockToV10,
  migrateScrapbookPageToV10,
  migrateScrapbookToV10,
} from '../../domain/scrapbooks/scrapbookMigration.ts';

export const BACKUP_SCHEMA_VERSION = 10;

export interface TravelLogBackup {
  app: 'travel-log-pwa';
  schemaVersion: number;
  exportedAt: string;
  data: {
    trips: Trip[];
    placeVisits: PlaceVisit[];
    tripTransportLegs: TripTransportLeg[];
    wishlistItems: WishlistItem[];
    collections: Collection[];
    collectionItems: CollectionItem[];
    collectionVisits: CollectionVisit[];
    prefectureVisits: PrefectureVisit[];
    tripPrefectureVisits: TripPrefectureVisit[];
    castleVisitSummaries: CastleVisitSummary[];
    castleVisitEvents: CastleVisitEvent[];
    scrapbooks: Scrapbook[];
    scrapbookPages: ScrapbookPage[];
    scrapbookBlocks: ScrapbookBlock[];
    mediaAssets: MediaAsset[];
    manualTimelineEntries: ManualTimelineEntry[];
    travelGachaDraws: TravelGachaDraw[];
    rpgExperienceEntries: RpgExperienceEntry[];
    userRpgTitles: UserRpgTitle[];
    userRpgAchievements: UserRpgAchievement[];
    rpgQuests: RpgQuest[];
    tripRpgResults: TripRpgResult[];
    rpgSettings: RpgSettings[];
  };
}

export function normalizeBackupPayload(payload: unknown): TravelLogBackup {
  if (isObject(payload) && payload.app === 'travel-log-pwa' && isObject(payload.data)) {
    const data = payload.data as Record<string, unknown>;
    return {
      app: 'travel-log-pwa',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : new Date().toISOString(),
      data: {
        trips: arrayOrEmpty<Trip>(data.trips),
        placeVisits: arrayOrEmpty<PlaceVisit>(data.placeVisits),
        tripTransportLegs: sanitizeTripTransportLegs(data.tripTransportLegs),
        wishlistItems: arrayOrEmpty<WishlistItem>(data.wishlistItems),
        collections: arrayOrEmpty<Collection>(data.collections),
        collectionItems: arrayOrEmpty<CollectionItem>(data.collectionItems),
        collectionVisits: arrayOrEmpty<CollectionVisit>(data.collectionVisits),
        prefectureVisits: arrayOrEmpty<PrefectureVisit>(data.prefectureVisits),
        tripPrefectureVisits: arrayOrEmpty<TripPrefectureVisit>(data.tripPrefectureVisits),
        castleVisitSummaries: sanitizeCastleVisitSummaries(data.castleVisitSummaries),
        castleVisitEvents: sanitizeCastleVisitEvents(data.castleVisitEvents),
        scrapbooks: sanitizeScrapbooks(data.scrapbooks),
        scrapbookPages: sanitizeScrapbookPages(data.scrapbookPages),
        scrapbookBlocks: sanitizeScrapbookBlocks(data.scrapbookBlocks),
        mediaAssets: sanitizeMediaAssets(data.mediaAssets),
        manualTimelineEntries: sanitizeManualTimelineEntries(data.manualTimelineEntries),
        travelGachaDraws: sanitizeTravelGachaDraws(data.travelGachaDraws),
        rpgExperienceEntries: sanitizeExperienceEntries(data.rpgExperienceEntries),
        userRpgTitles: uniqueBy(arrayOrEmpty<UserRpgTitle>(data.userRpgTitles), (title) => title.titleId),
        userRpgAchievements: arrayOrEmpty<UserRpgAchievement>(data.userRpgAchievements),
        rpgQuests: arrayOrEmpty<RpgQuest>(data.rpgQuests).filter(isValidQuest),
        tripRpgResults: arrayOrEmpty<TripRpgResult>(data.tripRpgResults),
        rpgSettings: arrayOrEmpty<RpgSettings>(data.rpgSettings),
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
      tripTransportLegs: sanitizeTripTransportLegs(data.tripTransportLegs),
      wishlistItems: arrayOrEmpty<WishlistItem>(data.wishlistItems),
      collections: arrayOrEmpty<Collection>(data.collections),
      collectionItems: arrayOrEmpty<CollectionItem>(data.collectionItems),
      collectionVisits: arrayOrEmpty<CollectionVisit>(data.collectionVisits),
      prefectureVisits: arrayOrEmpty<PrefectureVisit>(data.prefectureVisits),
      tripPrefectureVisits: arrayOrEmpty<TripPrefectureVisit>(data.tripPrefectureVisits),
      castleVisitSummaries: sanitizeCastleVisitSummaries(data.castleVisitSummaries),
      castleVisitEvents: sanitizeCastleVisitEvents(data.castleVisitEvents),
      scrapbooks: sanitizeScrapbooks(data.scrapbooks),
      scrapbookPages: sanitizeScrapbookPages(data.scrapbookPages),
      scrapbookBlocks: sanitizeScrapbookBlocks(data.scrapbookBlocks),
      mediaAssets: sanitizeMediaAssets(data.mediaAssets),
      manualTimelineEntries: sanitizeManualTimelineEntries(data.manualTimelineEntries),
      travelGachaDraws: sanitizeTravelGachaDraws(data.travelGachaDraws),
      rpgExperienceEntries: sanitizeExperienceEntries(data.rpgExperienceEntries),
      userRpgTitles: uniqueBy(arrayOrEmpty<UserRpgTitle>(data.userRpgTitles), (title) => title.titleId),
      userRpgAchievements: arrayOrEmpty<UserRpgAchievement>(data.userRpgAchievements),
      rpgQuests: arrayOrEmpty<RpgQuest>(data.rpgQuests).filter(isValidQuest),
      tripRpgResults: arrayOrEmpty<TripRpgResult>(data.tripRpgResults),
      rpgSettings: arrayOrEmpty<RpgSettings>(data.rpgSettings),
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
      tripTransportLegs: data.tripTransportLegs ?? [],
      wishlistItems: data.wishlistItems ?? [],
      collections: data.collections ?? [],
      collectionItems: data.collectionItems ?? [],
      collectionVisits: data.collectionVisits ?? [],
      prefectureVisits: data.prefectureVisits ?? [],
      tripPrefectureVisits: data.tripPrefectureVisits ?? [],
      castleVisitSummaries: data.castleVisitSummaries ?? [],
      castleVisitEvents: data.castleVisitEvents ?? [],
      scrapbooks: data.scrapbooks ?? [],
      scrapbookPages: data.scrapbookPages ?? [],
      scrapbookBlocks: data.scrapbookBlocks ?? [],
      mediaAssets: data.mediaAssets ?? [],
      manualTimelineEntries: data.manualTimelineEntries ?? [],
      travelGachaDraws: data.travelGachaDraws ?? [],
      rpgExperienceEntries: data.rpgExperienceEntries ?? [],
      userRpgTitles: data.userRpgTitles ?? [],
      userRpgAchievements: data.userRpgAchievements ?? [],
      rpgQuests: data.rpgQuests ?? [],
      tripRpgResults: data.tripRpgResults ?? [],
      rpgSettings: data.rpgSettings ?? [],
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sanitizeExperienceEntries(value: unknown): RpgExperienceEntry[] {
  return uniqueBy(
    arrayOrEmpty<RpgExperienceEntry>(value).filter((entry) => entry.amount >= 0 && Boolean(entry.sourceKey)),
    (entry) => entry.sourceKey,
  );
}

function sanitizeTripTransportLegs(value: unknown): TripTransportLeg[] {
  const modes = ['walk', 'bike', 'train', 'shinkansen', 'bus', 'car', 'flight', 'ship', 'taxi', 'other'];
  return uniqueBy(
    arrayOrEmpty<TripTransportLeg>(value).filter((leg) =>
      Boolean(leg.id)
      && Boolean(leg.tripId)
      && /^\d{4}-\d{2}-\d{2}$/.test(leg.date)
      && Boolean(leg.fromName)
      && Boolean(leg.toName)
      && modes.includes(leg.transportMode)
      && Number.isFinite(leg.partyCount)
      && Number.isFinite(leg.totalCost)
      && ['manual', 'estimated', 'api'].includes(leg.costSource)
      && ['exact', 'high', 'medium', 'rough', 'unknown'].includes(leg.estimatePrecision),
    ),
    (leg) => leg.id,
  );
}

function sanitizeCastleVisitSummaries(value: unknown): CastleVisitSummary[] {
  return uniqueBy(
    arrayOrEmpty<CastleVisitSummary>(value).filter((summary) =>
      ['unvisited', 'planned', 'visited'].includes(summary.status)
      && ['unknown', 'not_acquired', 'acquired'].includes(summary.stampStatus)
      && ['unknown', 'not_acquired', 'acquired'].includes(summary.goshuinStatus)
      && Boolean(summary.castleId),
    ),
    (summary) => summary.castleId,
  );
}

function sanitizeCastleVisitEvents(value: unknown): CastleVisitEvent[] {
  return uniqueBy(
    arrayOrEmpty<CastleVisitEvent>(value).filter((event) =>
      Boolean(event.castleId) && Boolean(event.sourceKey) && Boolean(event.visitedAt),
    ),
    (event) => event.sourceKey,
  );
}

function sanitizeScrapbooks(value: unknown): Scrapbook[] {
  return uniqueBy(
    arrayOrEmpty<Scrapbook>(value).map(migrateScrapbookToV10).filter((scrapbook) =>
      Boolean(scrapbook.id)
      && Boolean(scrapbook.tripId)
      && ['draft', 'completed', 'archived'].includes(scrapbook.status)
      && ['timeline', 'pages', 'freeform'].includes(scrapbook.layoutMode)
      && ['classic', 'journal', 'minimal', 'adventure'].includes(scrapbook.themeId),
    ),
    (scrapbook) => scrapbook.id,
  );
}

function sanitizeScrapbookPages(value: unknown): ScrapbookPage[] {
  return uniqueBy(
    arrayOrEmpty<ScrapbookPage>(value).map(migrateScrapbookPageToV10).filter((page) =>
      Boolean(page.id)
      && Boolean(page.scrapbookId)
      && Number.isFinite(page.sortOrder)
      && ['cover', 'day', 'section', 'summary'].includes(page.layoutType),
    ),
    (page) => page.id,
  );
}

function sanitizeScrapbookBlocks(value: unknown): ScrapbookBlock[] {
  const blockTypes = ['text', 'heading', 'photo', 'photo_grid', 'place', 'meal', 'ticket', 'purchase', 'quote', 'divider', 'trip_summary', 'rpg_result'];
  return uniqueBy(
    arrayOrEmpty<ScrapbookBlock>(value).map(migrateScrapbookBlockToV10).filter((block) =>
      Boolean(block.id)
      && Boolean(block.pageId)
      && Number.isFinite(block.sortOrder)
      && blockTypes.includes(block.type),
    ),
    (block) => block.id,
  );
}

function sanitizeMediaAssets(value: unknown): MediaAsset[] {
  return uniqueBy(
    arrayOrEmpty<MediaAsset>(value).filter((asset) =>
      Boolean(asset.id)
      && Boolean(asset.tripId)
      && ['local', 'remote', 'external'].includes(asset.storageType)
      && ['local_only', 'pending', 'synced', 'failed'].includes(asset.mediaSyncStatus),
    ),
    (asset) => asset.id,
  );
}

function sanitizeManualTimelineEntries(value: unknown): ManualTimelineEntry[] {
  return uniqueBy(
    arrayOrEmpty<ManualTimelineEntry>(value).filter((entry) =>
      Boolean(entry.id)
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && ['exact', 'minute', 'hour', 'day', 'range', 'unknown'].includes(entry.timePrecision)
      && ['exact', 'high', 'medium', 'low', 'unknown'].includes(entry.confidence)
      && entry.sourceType === 'manual',
    ),
    (entry) => entry.id,
  );
}

function sanitizeTravelGachaDraws(value: unknown): TravelGachaDraw[] {
  const modes = ['random', 'condition', 'unvisited', 'wishlist', 'castle', 'nearby', 'revisit', 'omakase'];
  return uniqueBy(
    arrayOrEmpty<TravelGachaDraw>(value).filter((draw) =>
      Boolean(draw.id)
      && modes.includes(draw.mode)
      && Boolean(draw.selectedCandidateId)
      && Boolean(draw.candidateSnapshot?.id)
      && Number.isFinite(draw.candidateCount)
      && draw.candidateCount >= 0
      && Number.isFinite(draw.score)
      && Boolean(draw.drawnAt),
    ),
    (draw) => draw.id,
  );
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = getKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isValidQuest(quest: RpgQuest): boolean {
  return ['available', 'in_progress', 'completed', 'claimed', 'expired'].includes(quest.status);
}
