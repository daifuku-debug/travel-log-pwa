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
import type { PlaceVisit, Trip } from '../../domain/models/trip';
import type { WishlistItem } from '../../domain/models/wishlist';

export const BACKUP_SCHEMA_VERSION = 5;

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
    castleVisitSummaries: CastleVisitSummary[];
    castleVisitEvents: CastleVisitEvent[];
    scrapbooks: Scrapbook[];
    scrapbookPages: ScrapbookPage[];
    scrapbookBlocks: ScrapbookBlock[];
    mediaAssets: MediaAsset[];
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
        castleVisitSummaries: sanitizeCastleVisitSummaries(data.castleVisitSummaries),
        castleVisitEvents: sanitizeCastleVisitEvents(data.castleVisitEvents),
        scrapbooks: sanitizeScrapbooks(data.scrapbooks),
        scrapbookPages: sanitizeScrapbookPages(data.scrapbookPages),
        scrapbookBlocks: sanitizeScrapbookBlocks(data.scrapbookBlocks),
        mediaAssets: sanitizeMediaAssets(data.mediaAssets),
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
    arrayOrEmpty<Scrapbook>(value).filter((scrapbook) =>
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
    arrayOrEmpty<ScrapbookPage>(value).filter((page) =>
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
    arrayOrEmpty<ScrapbookBlock>(value).filter((block) =>
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
