import type { CastleMaster, CastleVisitEvent } from '../../domain/models/castle';
import type { EntityId, IsoDateString } from '../../domain/models/common';
import type { CollectionItem, CollectionVisit } from '../../domain/models/collection';
import type { MediaAsset, Scrapbook, ScrapbookPage } from '../../domain/models/scrapbook';
import type {
  LocationInferenceResult,
  ManualTimelineEntry,
  TimelineConfidence,
  TimelineEvent,
  TimelineEventSource,
  TimePrecision,
} from '../../domain/models/timeMachine';
import type { PlaceVisit, Trip } from '../../domain/models/trip';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { isValidDateInputValue, todayDateInputValue } from '../../shared/date/dateUtils';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { inferLocationFromTimeline } from './locationInferenceService';
import { filterTripMediaAssets } from '../../domain/media/mediaAssetUsage';

const LOCAL_USER_ID = 'local-user';
const DEFAULT_TIMEZONE = 'Asia/Tokyo';
const TIME_QUERY_WINDOW_HOURS = 2;

export interface TimeMachineQuery {
  date: IsoDateString;
  time?: string;
  includeEstimated?: boolean;
  includeRpg?: boolean;
  includeCollections?: boolean;
}

export interface TimeMachineManualInput {
  date: IsoDateString;
  time?: string;
  endTime?: string;
  locationName: string;
  note: string;
  tripId?: EntityId;
  confidence: TimelineConfidence;
}

export interface TimeMachineResult {
  query: Required<Pick<TimeMachineQuery, 'date'>> & Omit<TimeMachineQuery, 'date'>;
  queryAt?: string;
  events: TimelineEvent[];
  timedEvents: TimelineEvent[];
  untimedEvents: TimelineEvent[];
  photos: MediaAsset[];
  relatedTrips: Array<Trip & { dayNumber: number; dayCount: number }>;
  relatedScrapbooks: Array<Scrapbook & { pages: ScrapbookPage[] }>;
  locationInference: LocationInferenceResult;
  mapPoints: TimelineEvent[];
  empty: boolean;
}

export function getLastYearDate(date: IsoDateString): { date: IsoDateString; adjustedReason?: string } {
  const [yearText, monthText, dayText] = date.split('-');
  const lastYear = Number(yearText) - 1;
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(lastYear, month - 1, day);
  if (candidate.getFullYear() === lastYear && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
    return { date: toDateInput(candidate) };
  }
  return {
    date: `${lastYear}-02-28`,
    adjustedReason: '去年に同じ日付がないため、2月28日を表示します。',
  };
}

export function shiftDate(date: IsoDateString, days: number): IsoDateString {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return toDateInput(next);
}

export async function getTimeMachineResult(query: TimeMachineQuery): Promise<TimeMachineResult> {
  try {
    validateQuery(query);
    const normalizedQuery = {
      includeEstimated: true,
      includeRpg: true,
      includeCollections: true,
      ...query,
    };
    const queryAt = normalizedQuery.time ? localDateTimeToIso(normalizedQuery.date, normalizedQuery.time) : undefined;
    const [
      trips,
      placeVisits,
      mediaAssets,
      scrapbooks,
      scrapbookPages,
      castleMaster,
      castleEvents,
      collectionItems,
      collectionVisits,
      manualEntries,
      rpgEntries,
      userAchievements,
      userTitles,
    ] = await Promise.all([
      repositories.trips.list(),
      repositories.placeVisits.list(),
      repositories.mediaAssets.list(),
      repositories.scrapbooks.list(),
      repositories.scrapbookPages.list(),
      repositories.castleMaster.list(),
      repositories.castleVisitEvents.list(),
      repositories.collectionItems.list(),
      repositories.collectionVisits.list(),
      repositories.manualTimelineEntries.listByDate(normalizedQuery.date),
      normalizedQuery.includeRpg ? repositories.rpgExperienceEntries.list() : Promise.resolve([]),
      normalizedQuery.includeRpg ? repositories.userRpgAchievements.list() : Promise.resolve([]),
      normalizedQuery.includeRpg ? repositories.userRpgTitles.list() : Promise.resolve([]),
    ]);
    const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
    const castleById = new Map(castleMaster.map((castle) => [castle.id, castle]));
    const collectionItemById = new Map(collectionItems.map((item) => [item.id, item]));
    const tripMediaAssets = filterTripMediaAssets(mediaAssets);

    const relatedTrips = trips
      .filter((trip) => dateInRange(normalizedQuery.date, trip.startDate, trip.endDate))
      .map((trip) => ({
        ...trip,
        dayNumber: daysBetween(trip.startDate, normalizedQuery.date) + 1,
        dayCount: daysBetween(trip.startDate, trip.endDate) + 1,
      }));
    const relatedTripIds = new Set(relatedTrips.map((trip) => trip.id));
    const relatedScrapbooks = scrapbooks
      .filter((scrapbook) => relatedTripIds.has(scrapbook.tripId))
      .map((scrapbook) => ({
        ...scrapbook,
        pages: scrapbookPages.filter((page) => page.scrapbookId === scrapbook.id && (!page.date || page.date === normalizedQuery.date)),
      }));

    const events = filterEstimatedEvents(dedupeTimelineEvents([
      ...buildTripEvents(relatedTrips),
      ...buildPlaceVisitEvents(placeVisits, tripsById, normalizedQuery.date, queryAt),
      ...buildPhotoEvents(tripMediaAssets, tripsById, normalizedQuery.date, queryAt),
      ...buildScrapbookEvents(relatedScrapbooks, normalizedQuery.date),
      ...buildManualEvents(manualEntries),
      ...buildCastleEvents(castleEvents, castleById, tripsById, normalizedQuery.date),
      ...(normalizedQuery.includeCollections ? buildCollectionEvents(collectionVisits, collectionItemById, tripsById, normalizedQuery.date) : []),
      ...(normalizedQuery.includeRpg ? buildRpgEvents(rpgEntries, userAchievements, userTitles, normalizedQuery.date) : []),
    ]), normalizedQuery.includeEstimated).sort(compareTimelineEvents);

    const photos = tripMediaAssets.filter((asset) => isMediaOnDate(asset, normalizedQuery.date, queryAt));
    const locationInference = inferLocationFromTimeline(events, queryAt);
    const mapPoints = events.filter((event) => isValidCoordinate(event.latitude, event.longitude));

    return {
      query: normalizedQuery,
      queryAt,
      events,
      timedEvents: events.filter((event) => event.startAt && event.timePrecision !== 'day'),
      untimedEvents: events.filter((event) => !event.startAt || event.timePrecision === 'day'),
      photos,
      relatedTrips,
      relatedScrapbooks,
      locationInference,
      mapPoints,
      empty: events.length === 0,
    };
  } catch (error) {
    throw toAppError(error, 'タイムマシンの読み込みに失敗しました');
  }
}

export async function createManualTimelineEntry(input: TimeMachineManualInput): Promise<ManualTimelineEntry> {
  try {
    if (!isValidDateInputValue(input.date)) throw new Error('日付が不正です。');
    if (!input.locationName.trim() && !input.note.trim()) throw new Error('場所またはメモを入力してください。');
    const now = new Date().toISOString();
    const hasTime = Boolean(input.time);
    return repositories.manualTimelineEntries.save({
      id: createId('manual-timeline'),
      userId: LOCAL_USER_ID,
      date: input.date,
      startAt: input.time ? localDateTimeToIso(input.date, input.time) : undefined,
      endAt: input.endTime ? localDateTimeToIso(input.date, input.endTime) : undefined,
      timePrecision: hasTime ? 'minute' : 'day',
      locationName: optionalText(input.locationName),
      note: optionalText(input.note),
      tripId: optionalText(input.tripId),
      sourceType: 'manual',
      confidence: input.confidence,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '手動補完の保存に失敗しました');
  }
}

export function getDefaultTimeMachineQuery(): TimeMachineQuery {
  return {
    date: todayDateInputValue(),
    includeEstimated: true,
    includeRpg: true,
    includeCollections: true,
  };
}

function buildTripEvents(trips: Array<Trip & { dayNumber: number; dayCount: number }>): TimelineEvent[] {
  return trips.flatMap((trip) => [
    createEvent({
      id: `trip:${trip.id}:day:${trip.dayNumber}`,
      eventType: trip.dayNumber === 1 ? 'trip_start' : trip.dayNumber === trip.dayCount ? 'trip_end' : 'memo',
      sourceType: 'trip',
      sourceId: trip.id,
      title: trip.title,
      description: `${trip.dayCount}日間のうち${trip.dayNumber}日目。旅行期間からの推定です。`,
      localDate: addDays(trip.startDate, trip.dayNumber - 1),
      timePrecision: 'day',
      tripId: trip.id,
      confidence: 'low',
      confidenceReason: '旅行期間に指定日が含まれます。具体的な滞在地点は旅行期間だけでは断定しません。',
      sourcePriority: 7,
      detailPath: `/trips/${trip.id}`,
    }),
  ]);
}

function buildPlaceVisitEvents(
  places: PlaceVisit[],
  tripsById: Map<string, Trip>,
  date: IsoDateString,
  queryAt?: string,
): TimelineEvent[] {
  return places.flatMap((place) => {
    const trip = tripsById.get(place.tripId);
    const localDate = place.visitedAt ? isoToLocalDate(place.visitedAt) : trip && dateInRange(date, trip.startDate, trip.endDate) ? date : undefined;
    if (localDate !== date) return [];
    if (queryAt && place.visitedAt && !withinHours(place.visitedAt, queryAt, TIME_QUERY_WINDOW_HOURS)) return [];
    const hasTime = Boolean(place.visitedAt);
    return createEvent({
      id: `place:${place.id}`,
      eventType: place.castleId ? 'castle_visit' : 'visit',
      sourceType: 'placeVisit',
      sourceId: place.id,
      title: place.name,
      description: place.memo,
      startAt: place.visitedAt,
      localDate,
      timePrecision: hasTime ? 'minute' : 'day',
      latitude: validCoordinate(place.latitude) ? place.latitude : undefined,
      longitude: validCoordinate(place.longitude) ? place.longitude : undefined,
      locationName: place.name,
      tripId: place.tripId,
      confidence: hasTime && isValidCoordinate(place.latitude, place.longitude) ? 'exact' : hasTime ? 'high' : 'medium',
      confidenceReason: hasTime ? '訪問日時が記録されています。' : '旅行日程と訪問場所から、この日に訪問した可能性があります。',
      sourcePriority: hasTime ? 3 : 6,
      detailPath: `/trips/${place.tripId}`,
    });
  });
}

function buildPhotoEvents(
  assets: MediaAsset[],
  tripsById: Map<string, Trip>,
  date: IsoDateString,
  queryAt?: string,
): TimelineEvent[] {
  return assets.flatMap((asset) => {
    const trip = tripsById.get(asset.tripId);
    const localDate = asset.takenAt ? isoToLocalDate(asset.takenAt) : trip && dateInRange(date, trip.startDate, trip.endDate) ? date : undefined;
    if (localDate !== date) return [];
    if (queryAt && asset.takenAt && !withinHours(asset.takenAt, queryAt, TIME_QUERY_WINDOW_HOURS)) return [];
    const hasLocation = isValidCoordinate(asset.latitude, asset.longitude);
    return createEvent({
      id: `photo:${asset.id}`,
      eventType: 'photo',
      sourceType: 'mediaAsset',
      sourceId: asset.id,
      title: asset.originalFileName || '写真',
      description: asset.takenAt ? 'アプリに追加された写真です。' : '撮影日時がないため、旅行期間からの関連写真です。',
      startAt: asset.takenAt,
      localDate,
      timePrecision: asset.takenAt ? 'minute' : 'unknown',
      latitude: hasLocation ? asset.latitude : undefined,
      longitude: hasLocation ? asset.longitude : undefined,
      assetIds: [asset.id],
      tripId: asset.tripId,
      confidence: asset.takenAt && hasLocation ? 'exact' : asset.takenAt ? 'medium' : 'low',
      confidenceReason: asset.takenAt && hasLocation ? '撮影日時と位置情報がある写真です。' : asset.takenAt ? '撮影日時はありますが位置情報はありません。' : '撮影日時がないため、旅行との関連から表示しています。',
      sourcePriority: asset.takenAt && hasLocation ? 2 : 5,
      detailPath: `/trips/${asset.tripId}/scrapbook`,
    });
  });
}

function buildScrapbookEvents(
  scrapbooks: Array<Scrapbook & { pages: ScrapbookPage[] }>,
  date: IsoDateString,
): TimelineEvent[] {
  return scrapbooks.flatMap((scrapbook) => {
    const pages = scrapbook.pages.filter((page) => !page.date || page.date === date);
    if (pages.length === 0) return [];
    return createEvent({
      id: `scrapbook:${scrapbook.id}:${date}`,
      eventType: 'scrapbook',
      sourceType: 'scrapbook',
      sourceId: scrapbook.id,
      title: scrapbook.title,
      description: `${pages.length}ページが関連しています。`,
      localDate: date,
      timePrecision: 'day',
      tripId: scrapbook.tripId,
      scrapbookId: scrapbook.id,
      confidence: 'low',
      confidenceReason: '関連旅行または日付ページからの関連です。場所は断定しません。',
      sourcePriority: 6,
      detailPath: `/trips/${scrapbook.tripId}/scrapbook`,
    });
  });
}

function buildManualEvents(entries: ManualTimelineEntry[]): TimelineEvent[] {
  return entries.map((entry) => createEvent({
    id: `manual:${entry.id}`,
    eventType: 'manual_location',
    sourceType: 'manualTimelineEntry',
    sourceId: entry.id,
    title: entry.locationName || '手動メモ',
    description: entry.note,
    startAt: entry.startAt,
    endAt: entry.endAt,
    localDate: entry.date,
    timePrecision: entry.timePrecision,
    latitude: validCoordinate(entry.latitude) ? entry.latitude : undefined,
    longitude: validCoordinate(entry.longitude) ? entry.longitude : undefined,
    locationName: entry.locationName,
    tripId: entry.tripId,
    confidence: entry.confidence,
    confidenceReason: 'ユーザーが手動で補完した記録です。',
    sourcePriority: 5,
  }));
}

function buildCastleEvents(
  events: CastleVisitEvent[],
  castleById: Map<string, CastleMaster>,
  tripsById: Map<string, Trip>,
  date: IsoDateString,
): TimelineEvent[] {
  return events.flatMap((event) => {
    if (event.visitedAt !== date) return [];
    const castle = castleById.get(event.castleId);
    const trip = event.tripId ? tripsById.get(event.tripId) : undefined;
    return createEvent({
      id: `castle:${event.sourceKey}`,
      eventType: 'castle_visit',
      sourceType: 'castleVisit',
      sourceId: event.id,
      title: castle?.nameJa ?? '城訪問',
      description: [event.stampAcquired ? 'スタンプ取得' : '', event.goshuinAcquired ? '御城印取得' : '', event.note].filter(Boolean).join(' / '),
      localDate: date,
      timePrecision: 'day',
      latitude: validCoordinate(castle?.latitude ?? undefined) ? castle?.latitude ?? undefined : undefined,
      longitude: validCoordinate(castle?.longitude ?? undefined) ? castle?.longitude ?? undefined : undefined,
      locationName: castle?.nameJa,
      prefectureCode: castle?.prefectureCode,
      tripId: trip?.id,
      confidence: 'medium',
      confidenceReason: '城コレクションの訪問日記録です。時刻は不明です。',
      sourcePriority: 6,
      detailPath: '/castles',
    });
  });
}

function buildCollectionEvents(
  visits: CollectionVisit[],
  itemById: Map<string, CollectionItem>,
  tripsById: Map<string, Trip>,
  date: IsoDateString,
): TimelineEvent[] {
  return visits.flatMap((visit) => {
    if (isoToLocalDate(visit.visitedAt) !== date) return [];
    const item = itemById.get(visit.collectionItemId);
    const trip = visit.tripId ? tripsById.get(visit.tripId) : undefined;
    return createEvent({
      id: `collection:${visit.id}`,
      eventType: 'collection_unlock',
      sourceType: 'collectionVisit',
      sourceId: visit.id,
      title: item?.name ?? 'コレクション訪問',
      description: visit.memo,
      startAt: visit.visitedAt,
      localDate: date,
      timePrecision: 'minute',
      latitude: validCoordinate(item?.latitude) ? item?.latitude : undefined,
      longitude: validCoordinate(item?.longitude) ? item?.longitude : undefined,
      locationName: item?.name,
      tripId: trip?.id,
      confidence: isValidCoordinate(item?.latitude, item?.longitude) ? 'high' : 'medium',
      confidenceReason: 'コレクションの訪問日時から表示しています。',
      sourcePriority: 5,
      detailPath: '/collections',
    });
  });
}

function buildRpgEvents(
  entries: Awaited<ReturnType<typeof repositories.rpgExperienceEntries.list>>,
  achievements: Awaited<ReturnType<typeof repositories.userRpgAchievements.list>>,
  titles: Awaited<ReturnType<typeof repositories.userRpgTitles.list>>,
  date: IsoDateString,
): TimelineEvent[] {
  const expEvents = entries
    .filter((entry) => isoToLocalDate(entry.earnedAt) === date)
    .map((entry) => createEvent({
      id: `rpg-exp:${entry.id}`,
      eventType: 'achievement' as const,
      sourceType: 'rpgExperience' as const,
      sourceId: entry.id,
      title: `${entry.effectiveAmount} EXP`,
      description: entry.reason,
      startAt: entry.earnedAt,
      localDate: date,
      timePrecision: 'minute' as const,
      confidence: 'exact' as const,
      confidenceReason: 'RPG経験値の獲得日時です。',
      sourcePriority: 5,
      detailPath: '/rpg/experience',
    }));
  const achievementEvents = achievements
    .filter((achievement) => achievement.unlockedAt && isoToLocalDate(achievement.unlockedAt) === date)
    .map((achievement) => createEvent({
      id: `rpg-achievement:${achievement.id}`,
      eventType: 'achievement' as const,
      sourceType: 'rpgAchievement' as const,
      sourceId: achievement.id,
      title: '実績解除',
      description: achievement.achievementId,
      startAt: achievement.unlockedAt,
      localDate: date,
      timePrecision: 'minute' as const,
      confidence: 'exact' as const,
      confidenceReason: '実績解除日時です。',
      sourcePriority: 5,
      detailPath: '/rpg/achievements',
    }));
  const titleEvents = titles
    .filter((title) => isoToLocalDate(title.unlockedAt) === date)
    .map((title) => createEvent({
      id: `rpg-title:${title.id}`,
      eventType: 'title_acquired' as const,
      sourceType: 'rpgTitle' as const,
      sourceId: title.id,
      title: '称号獲得',
      description: title.titleId,
      startAt: title.unlockedAt,
      localDate: date,
      timePrecision: 'minute' as const,
      confidence: 'exact' as const,
      confidenceReason: '称号獲得日時です。',
      sourcePriority: 5,
      detailPath: '/rpg/titles',
    }));
  return [...expEvents, ...achievementEvents, ...titleEvents];
}

function dedupeTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  const merged = new Map<string, TimelineEvent>();
  for (const event of events) {
    const key = event.locationName && event.localDate && event.tripId
      ? `${event.eventType}:${event.tripId}:${event.localDate}:${event.locationName}`
      : `${event.sourceType}:${event.sourceId}:${event.eventType}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, event);
      continue;
    }
    merged.set(key, {
      ...current,
      assetIds: [...new Set([...current.assetIds, ...event.assetIds])],
      confidence: confidenceRank(event.confidence) > confidenceRank(current.confidence) ? event.confidence : current.confidence,
      sourcePriority: Math.min(current.sourcePriority, event.sourcePriority),
      sources: [...current.sources, ...event.sources],
    });
  }
  return [...merged.values()];
}

function filterEstimatedEvents(events: TimelineEvent[], includeEstimated = true): TimelineEvent[] {
  if (includeEstimated) return events;
  return events.filter((event) => event.confidence === 'exact' || event.confidence === 'high');
}

function createEvent(input: Omit<TimelineEvent, 'timezone' | 'assetIds' | 'sources'> & Partial<Pick<TimelineEvent, 'timezone' | 'assetIds' | 'sources'>>): TimelineEvent {
  const event = {
    timezone: DEFAULT_TIMEZONE,
    assetIds: [],
    ...input,
  };
  return {
    ...event,
    sources: input.sources ?? [toEventSource(event)],
  };
}

function toEventSource(event: Pick<TimelineEvent, 'sourceType' | 'sourceId' | 'startAt' | 'confidence' | 'title'>): TimelineEventSource {
  return {
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    timestamp: event.startAt,
    reliability: event.confidence,
    summary: event.title,
  };
}

function compareTimelineEvents(a: TimelineEvent, b: TimelineEvent): number {
  if (!a.startAt && !b.startAt) return a.sourcePriority - b.sourcePriority;
  if (!a.startAt) return 1;
  if (!b.startAt) return -1;
  return a.startAt.localeCompare(b.startAt) || a.sourcePriority - b.sourcePriority;
}

function validateQuery(query: TimeMachineQuery): void {
  if (!isValidDateInputValue(query.date)) throw new Error('日付が不正です。');
  if (query.time && !/^\d{2}:\d{2}$/.test(query.time)) throw new Error('時刻が不正です。');
}

function isMediaOnDate(asset: MediaAsset, date: IsoDateString, queryAt?: string): boolean {
  if (!asset.takenAt) return false;
  if (isoToLocalDate(asset.takenAt) !== date) return false;
  return queryAt ? withinHours(asset.takenAt, queryAt, TIME_QUERY_WINDOW_HOURS) : true;
}

function dateInRange(date: IsoDateString, start: IsoDateString, end: IsoDateString): boolean {
  return start <= date && date <= end;
}

function withinHours(value: string, center: string, hours: number): boolean {
  return Math.abs(new Date(value).getTime() - new Date(center).getTime()) <= hours * 60 * 60 * 1000;
}

function isoToLocalDate(value: string): IsoDateString {
  return toDateInput(new Date(value));
}

function localDateTimeToIso(date: IsoDateString, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function toDateInput(date: Date): IsoDateString {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: IsoDateString, days: number): IsoDateString {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return toDateInput(next);
}

function daysBetween(start: IsoDateString, end: IsoDateString): number {
  return Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000);
}

function validCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidCoordinate(latitude?: number, longitude?: number): boolean {
  return validCoordinate(latitude) && validCoordinate(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function confidenceRank(confidence: TimelineConfidence): number {
  return { unknown: 0, low: 1, medium: 2, high: 3, exact: 4 }[confidence];
}

function optionalText(value?: string): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed || undefined;
}
