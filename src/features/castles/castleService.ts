import type { EntityId } from '../../domain/models/common';
import type { CastleMaster, CastleVisitSummary } from '../../domain/models/castle';
import type { PlaceVisit } from '../../domain/models/trip';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { isoDateTimeToDateInput, todayDateInputValue } from '../../shared/date/dateUtils';
import { refreshRpgProgress } from '../rpg/rpgProgressService';
import { grantExperienceOnce } from '../rpg/experienceService';
import {
  buildCastleSummaryFromInput,
  calculateCastleStats,
  filterCastleRows,
  mergeCastleRows,
  validateCastleRecordInput,
  type CastleFilter,
  type CastleListRow,
  type CastleRecordInput,
  type CastleCollectionStats,
} from './castleLogic';

const LOCAL_USER_ID = 'local-user';

export interface CastleCollectionView {
  rows: CastleListRow[];
  filteredRows: CastleListRow[];
  stats: CastleCollectionStats;
  castles: CastleMaster[];
}

export interface CastleOption {
  id: EntityId;
  label: string;
}

export interface CastleRelatedTrip {
  tripId: EntityId;
  title: string;
  startDate: string;
  endDate: string;
  placeNames: string[];
}

export async function listCastleOptions(): Promise<CastleOption[]> {
  try {
    const castles = await repositories.castleMaster.list();
    return castles.map((castle) => ({
      id: castle.id,
      label: `${castle.sourceNumber}. ${castle.nameJa}（${castle.prefectureName}${castle.municipality}）`,
    }));
  } catch (error) {
    throw toAppError(error, '城一覧の読み込みに失敗しました');
  }
}

export async function getCastleCollectionView(filter: CastleFilter): Promise<CastleCollectionView> {
  try {
    const [castles, summaries] = await Promise.all([
      repositories.castleMaster.list(),
      repositories.castleVisitSummaries.list(),
    ]);
    const rows = mergeCastleRows(castles, summaries);
    return {
      rows,
      filteredRows: filterCastleRows(rows, filter),
      stats: calculateCastleStats(rows),
      castles,
    };
  } catch (error) {
    throw toAppError(error, '城コレクションの読み込みに失敗しました');
  }
}

export async function updateCastleRecord(castleId: EntityId, input: CastleRecordInput): Promise<CastleVisitSummary> {
  try {
    assertNoValidationErrors(validateCastleRecordInput(input));
    const castle = await repositories.castleMaster.getById(castleId);
    if (!castle) throw new Error('城マスターが見つかりません。');
    const current = await repositories.castleVisitSummaries.getByCastleId(castleId);
    const now = new Date().toISOString();
    const next = buildCastleSummaryFromInput(castleId, current, input, now);
    const saved = await repositories.castleVisitSummaries.save(next);

    await ensureManualVisitEvent(castleId, current, saved);
    await grantCastleExperience(castle, current, saved);
    await refreshRpgProgress();
    return saved;
  } catch (error) {
    throw toAppError(error, '城記録の保存に失敗しました');
  }
}

export async function linkCastleVisitFromTripPlace(place: PlaceVisit): Promise<void> {
  if (!place.castleId) return;
  try {
    const castle = await repositories.castleMaster.getById(place.castleId);
    if (!castle) return;
    const current = await repositories.castleVisitSummaries.getByCastleId(place.castleId);
    const now = new Date().toISOString();
    const visitedDate = isoDateTimeToDateInput(place.visitedAt) || todayDateInputValue();
    const sourceKey = `castle-visit:trip:${place.id}`;
    const existingEvent = await repositories.castleVisitEvents.getBySourceKey(sourceKey);
    const nextVisitCount = existingEvent ? Math.max(current?.visitCount ?? 1, 1) : (current?.visitCount ?? 0) + 1;
    const next: CastleVisitSummary = {
      ...(current ?? {
        id: place.castleId,
        userId: LOCAL_USER_ID,
        castleId: place.castleId,
        createdAt: now,
        stampStatus: 'unknown',
        goshuinStatus: 'unknown',
        isFavorite: false,
        relatedTripIds: [],
        syncStatus: 'pending',
      }),
      status: 'visited',
      firstVisitedAt: minDate(current?.firstVisitedAt, visitedDate),
      lastVisitedAt: maxDate(current?.lastVisitedAt, visitedDate),
      visitCount: Math.max(nextVisitCount, 1),
      relatedTripIds: unique([...(current?.relatedTripIds ?? []), place.tripId]),
      updatedAt: now,
      syncStatus: 'pending',
    };
    const saved = await repositories.castleVisitSummaries.save(next);
    if (!existingEvent) {
      await repositories.castleVisitEvents.save({
        id: createId('castle-event'),
        userId: LOCAL_USER_ID,
        castleId: place.castleId,
        visitedAt: visitedDate,
        tripId: place.tripId,
        locationId: place.id,
        stampAcquired: false,
        goshuinAcquired: false,
        source: 'trip',
        sourceKey,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      });
    }
    await grantCastleExperience(castle, current, saved);
    await refreshRpgProgress();
  } catch (error) {
    throw toAppError(error, '旅行記録から城コレクションへの反映に失敗しました');
  }
}

export async function listCastleRelatedTrips(castleId: EntityId): Promise<CastleRelatedTrip[]> {
  try {
    const [places, trips] = await Promise.all([
      repositories.placeVisits.list(),
      repositories.trips.list(),
    ]);
    const linkedPlaces = places.filter((place) => place.castleId === castleId);
    const placesByTripId = new Map<string, PlaceVisit[]>();
    for (const place of linkedPlaces) {
      placesByTripId.set(place.tripId, [...(placesByTripId.get(place.tripId) ?? []), place]);
    }
    return trips
      .filter((trip) => placesByTripId.has(trip.id))
      .map((trip) => ({
        tripId: trip.id,
        title: trip.title,
        startDate: trip.startDate,
        endDate: trip.endDate,
        placeNames: (placesByTripId.get(trip.id) ?? []).map((place) => place.name),
      }))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  } catch (error) {
    throw toAppError(error, '関連する旅行記録の読み込みに失敗しました');
  }
}

export async function removeTripRelationFromCastle(place: PlaceVisit): Promise<void> {
  if (!place.castleId) return;
  try {
    const current = await repositories.castleVisitSummaries.getByCastleId(place.castleId);
    if (!current) return;
    await repositories.castleVisitSummaries.save({
      ...current,
      relatedTripIds: current.relatedTripIds.filter((tripId) => tripId !== place.tripId),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '城コレクションの旅行関連付け解除に失敗しました');
  }
}

async function ensureManualVisitEvent(
  castleId: EntityId,
  current: CastleVisitSummary | undefined,
  next: CastleVisitSummary,
): Promise<void> {
  if (next.status !== 'visited') return;
  if ((current?.visitCount ?? 0) >= next.visitCount) return;
  const visitedAt = next.lastVisitedAt ?? next.firstVisitedAt;
  if (!visitedAt) return;
  const sourceKey = `castle-visit:manual:${castleId}:${next.visitCount}`;
  const existing = await repositories.castleVisitEvents.getBySourceKey(sourceKey);
  if (existing) return;
  const now = new Date().toISOString();
  await repositories.castleVisitEvents.save({
    id: createId('castle-event'),
    userId: LOCAL_USER_ID,
    castleId,
    visitedAt,
    stampAcquired: next.stampStatus === 'acquired',
    goshuinAcquired: next.goshuinStatus === 'acquired',
    source: 'manual',
    sourceKey,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  });
}

async function grantCastleExperience(
  castle: CastleMaster,
  current: CastleVisitSummary | undefined,
  next: CastleVisitSummary,
): Promise<void> {
  if (next.status === 'visited' && (current?.status !== 'visited')) {
    await grantExperienceOnce({
      amount: 30,
      sourceType: 'castle',
      sourceId: castle.id,
      sourceKey: `castle:first-visit:${castle.id}`,
      reason: `${castle.nameJa}に初登城`,
      metadata: { castleId: castle.id, series: castle.series },
    });
    await grantExperienceOnce({
      amount: 20,
      sourceType: 'castle',
      sourceId: castle.id,
      sourceKey: `castle:first-${castle.series}`,
      reason: `${castle.series === 'japanese_100_castles' ? '日本100名城' : '続日本100名城'}に初登城`,
      metadata: { castleId: castle.id, series: castle.series },
    });
  }

  const revisitDiff = Math.max(next.visitCount - Math.max(current?.visitCount ?? 0, current?.status === 'visited' ? 1 : 0), 0);
  for (let index = 0; index < revisitDiff; index += 1) {
    const visitNumber = (current?.visitCount ?? 0) + index + 1;
    if (visitNumber <= 1) continue;
    await grantExperienceOnce({
      amount: 5,
      sourceType: 'castle',
      sourceId: castle.id,
      sourceKey: `castle:revisit:${castle.id}:${visitNumber}`,
      reason: `${castle.nameJa}に再訪`,
      metadata: { castleId: castle.id, visitNumber },
    });
  }

  if (next.stampStatus === 'acquired' && current?.stampStatus !== 'acquired') {
    await grantExperienceOnce({
      amount: 20,
      sourceType: 'castle',
      sourceId: castle.id,
      sourceKey: `castle:stamp:${castle.id}`,
      reason: `${castle.nameJa}のスタンプを取得`,
      metadata: { castleId: castle.id, series: castle.series },
    });
  }

  if (next.goshuinStatus === 'acquired' && current?.goshuinStatus !== 'acquired') {
    await grantExperienceOnce({
      amount: 10,
      sourceType: 'castle',
      sourceId: castle.id,
      sourceKey: `castle:goshuin:${castle.id}`,
      reason: `${castle.nameJa}の御城印を取得`,
      metadata: { castleId: castle.id, series: castle.series },
    });
  }

  await grantCastleMilestoneExperience();
}

async function grantCastleMilestoneExperience(): Promise<void> {
  const [castles, summaries] = await Promise.all([
    repositories.castleMaster.list(),
    repositories.castleVisitSummaries.list(),
  ]);
  const rows = mergeCastleRows(castles, summaries);
  const stats = calculateCastleStats(rows);
  const milestones = [
    { count: 5, exp: 50 },
    { count: 10, exp: 100 },
    { count: 25, exp: 200 },
    { count: 50, exp: 400 },
    { count: 75, exp: 600 },
  ];
  for (const milestone of milestones) {
    if (stats.visitedCount >= milestone.count) {
      await grantExperienceOnce({
        amount: milestone.exp,
        sourceType: 'castle',
        sourceKey: `castle:milestone:${milestone.count}`,
        reason: `城コレクション${milestone.count}城達成`,
        metadata: { milestone: milestone.count },
      });
    }
  }
  if (stats.japanese100VisitedCount >= 100) {
    await grantExperienceOnce({ amount: 1500, sourceType: 'castle', sourceKey: 'castle:complete:j100', reason: '日本100名城を制覇' });
  }
  if (stats.continued100VisitedCount >= 100) {
    await grantExperienceOnce({ amount: 1500, sourceType: 'castle', sourceKey: 'castle:complete:zoku', reason: '続日本100名城を制覇' });
  }
  if (stats.visitedCount >= 200) {
    await grantExperienceOnce({ amount: 3000, sourceType: 'castle', sourceKey: 'castle:complete:all200', reason: '日本100名城・続日本100名城200城を制覇' });
  }
}

function assertNoValidationErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function minDate(current: string | undefined, next: string): string {
  if (!current) return next;
  return current < next ? current : next;
}

function maxDate(current: string | undefined, next: string): string {
  if (!current) return next;
  return current > next ? current : next;
}
