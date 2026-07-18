import type { CastleVisitSummary } from '../../domain/models/castle';
import type { CollectionItem } from '../../domain/models/collection';
import type { PrefectureMaster, PrefectureVisit } from '../../domain/models/japanConquest';
import type {
  TravelCandidate,
  TravelCandidateCostEstimate,
  TravelGachaDraw,
  TravelGachaMode,
  TravelGachaRandomnessLevel,
  TravelGachaSettings,
  TravelGachaTransportMode,
  TravelStyleTag,
} from '../../domain/models/travelGacha';
import type { PlaceVisit, Trip } from '../../domain/models/trip';
import type { WishlistItem } from '../../domain/models/wishlist';
import experienceRules from '../../domain/rpg/experienceRules.json';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { todayDateInputValue } from '../../shared/date/dateUtils';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { grantExperienceOnce } from '../rpg/experienceService';

const LOCAL_USER_ID = 'local-user';
const RECENT_DRAW_COUNT = 5;

export interface RandomProvider {
  next(): number;
}

export interface TravelGachaResult {
  settings: TravelGachaSettings;
  candidates: TravelCandidate[];
  rejectedCandidateCount: number;
  suggestions: string[];
  draw?: TravelGachaDraw;
}

export const defaultTravelGachaSettings: TravelGachaSettings = {
  departureLabel: '',
  tripDurationDays: 1,
  stayType: 'dayTrip',
  maxBudget: 15000,
  maxOneWayTravelMinutes: 180,
  transportModes: ['train'],
  candidateScope: 'all',
  travelStyleTags: [],
  regionCodes: [],
  prefectureCodes: [],
  prioritizeUnvisited: true,
  prioritizeWishlist: true,
  includeVisited: true,
  includeRecentlyVisited: true,
  includeRecentlyDrawn: false,
  randomnessLevel: 'balanced',
  candidateLimit: 30,
};

export async function previewTravelGacha(settings: TravelGachaSettings): Promise<TravelGachaResult> {
  try {
    validateSettings(settings);
    const candidates = await buildEligibleCandidates(settings);
    return {
      settings,
      candidates: candidates.accepted,
      rejectedCandidateCount: candidates.rejectedCount,
      suggestions: candidates.suggestions,
    };
  } catch (error) {
    throw toAppError(error, '旅ガチャ候補の読み込みに失敗しました');
  }
}

export async function drawTravelGacha(
  mode: TravelGachaMode,
  settings: TravelGachaSettings,
  rerolledFromDrawId?: string,
  randomProvider: RandomProvider = MathRandomProvider,
): Promise<TravelGachaResult> {
  try {
    validateSettings(settings);
    const candidates = await buildEligibleCandidates(settings, rerolledFromDrawId);
    const selected = pickWeightedCandidate(candidates.accepted, settings.randomnessLevel, randomProvider);
    if (!selected) {
      return {
        settings,
        candidates: [],
        rejectedCandidateCount: candidates.rejectedCount,
        suggestions: candidates.suggestions,
      };
    }
    const now = new Date().toISOString();
    const draw = await repositories.travelGachaDraws.save({
      id: createId('travel-gacha-draw'),
      userId: LOCAL_USER_ID,
      mode,
      settingsSnapshot: settings,
      selectedCandidateId: selected.id,
      candidateSnapshot: selected,
      candidateCount: candidates.accepted.length,
      score: selected.score,
      scoreReasons: selected.scoreReasons,
      drawnAt: now,
      rerolledFromDrawId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    await grantExperienceOnce({
      amount: experienceRules.travelGachaFirstDraw,
      sourceType: 'travelGacha',
      sourceId: draw.id,
      sourceKey: 'travel-gacha-first-draw',
      reason: '初めて旅ガチャを引いた',
      metadata: { drawId: draw.id },
    });
    return {
      settings,
      candidates: candidates.accepted,
      rejectedCandidateCount: candidates.rejectedCount,
      suggestions: candidates.suggestions,
      draw,
    };
  } catch (error) {
    throw toAppError(error, '旅ガチャの抽選に失敗しました');
  }
}

export async function acceptTravelGachaDraw(drawId: string): Promise<TravelGachaDraw> {
  try {
    const draw = await repositories.travelGachaDraws.getById(drawId);
    if (!draw) throw new Error('抽選結果が見つかりません。');
    if (draw.acceptedAt) return draw;
    const now = new Date().toISOString();
    const saved = await repositories.travelGachaDraws.save({
      ...draw,
      acceptedAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    await grantExperienceOnce({
      amount: experienceRules.travelGachaAccepted,
      sourceType: 'travelGacha',
      sourceId: draw.id,
      sourceKey: `travel-gacha-accepted:${draw.id}`,
      reason: '旅ガチャの結果を採用',
      metadata: { drawId: draw.id, candidateId: draw.selectedCandidateId },
    });
    return saved;
  } catch (error) {
    throw toAppError(error, '旅ガチャ結果の採用に失敗しました');
  }
}

export async function listRecentTravelGachaDraws(limit = 8): Promise<TravelGachaDraw[]> {
  try {
    return repositories.travelGachaDraws.listRecent(limit);
  } catch (error) {
    throw toAppError(error, '旅ガチャ履歴の読み込みに失敗しました');
  }
}

async function buildEligibleCandidates(
  settings: TravelGachaSettings,
  rerolledFromDrawId?: string,
): Promise<{ accepted: TravelCandidate[]; rejectedCount: number; suggestions: string[] }> {
  const [rawCandidates, recentDraws] = await Promise.all([
    buildTravelCandidates(settings),
    repositories.travelGachaDraws.listRecent(RECENT_DRAW_COUNT),
  ]);
  const recentDrawCandidateIds = new Set(recentDraws.map((draw) => draw.selectedCandidateId));
  const rerolledDraw = rerolledFromDrawId ? await repositories.travelGachaDraws.getById(rerolledFromDrawId) : undefined;
  const scored = rawCandidates
    .map((candidate) => applyEligibility(candidate, settings, recentDrawCandidateIds, rerolledDraw?.selectedCandidateId))
    .map((candidate) => scoreCandidate(candidate, settings));
  const accepted = scored
    .filter((candidate) => candidate.eligibility.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, settings.candidateLimit));
  const suggestions = buildSuggestions(scored);
  return {
    accepted,
    rejectedCount: scored.length - accepted.length,
    suggestions,
  };
}

async function buildTravelCandidates(settings: TravelGachaSettings): Promise<TravelCandidate[]> {
  const [
    prefectures,
    prefectureVisits,
    wishlistItems,
    placeVisits,
    trips,
    castles,
    castleSummaries,
    collections,
    collectionVisits,
  ] = await Promise.all([
    repositories.prefectureMaster.list(),
    repositories.prefectureVisits.list(),
    repositories.wishlist.list(),
    repositories.placeVisits.list(),
    repositories.trips.list(),
    repositories.castleMaster.list(),
    repositories.castleVisitSummaries.list(),
    repositories.collectionItems.list(),
    repositories.collectionVisits.list(),
  ]);
  const visitsByPrefecture = new Map(prefectureVisits.map((visit) => [visit.prefectureCode, visit]));
  const castleSummaryById = new Map(castleSummaries.map((summary) => [summary.castleId, summary]));
  const collectionVisitIds = new Set(collectionVisits.map((visit) => visit.collectionItemId));
  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const candidates = [
    ...prefectures.map((prefecture) => fromPrefecture(prefecture, visitsByPrefecture.get(prefecture.code), settings)),
    ...wishlistItems.filter((item) => item.status === 'want').map((item) => fromWishlist(item, settings)),
    ...placeVisits.map((place) => fromPlaceVisit(place, tripById.get(place.tripId), settings)),
    ...castles.map((castle) => fromCastle(castle, castleSummaryById.get(castle.id), settings)),
    ...collections.map((item) => fromCollectionItem(item, collectionVisitIds.has(item.id), settings)),
  ];
  return dedupeCandidates(candidates);
}

function fromPrefecture(prefecture: PrefectureMaster, visit: PrefectureVisit | undefined, settings: TravelGachaSettings): TravelCandidate {
  const isVisited = Boolean(visit && visit.status !== 'unvisited');
  return baseCandidate({
    id: `prefecture:${prefecture.code}`,
    sourceType: 'prefecture',
    sourceId: prefecture.code,
    name: `${prefecture.nameJa}旅`,
    description: `${prefecture.capital}周辺を起点にした都道府県候補です。`,
    prefectureCode: prefecture.code,
    prefectureName: prefecture.nameJa,
    regionCode: prefecture.region,
    tags: ['city_walk', 'photo'],
    isVisited,
    visitCount: visit?.visitCount ?? 0,
    lastVisitedAt: visit?.lastVisitedAt,
    sourcePriority: 6,
    settings,
  });
}

function fromWishlist(item: WishlistItem, settings: TravelGachaSettings): TravelCandidate {
  return baseCandidate({
    id: `wishlist:${item.id}`,
    sourceType: 'wishlist',
    sourceId: item.id,
    name: item.name,
    description: [item.shopName, item.memo].filter(Boolean).join(' / ') || '行きたい・買いたいメモからの候補です。',
    tags: ['gourmet', 'city_walk'],
    isWishlist: true,
    isVisited: false,
    visitCount: 0,
    sourcePriority: 2,
    settings,
  });
}

function fromPlaceVisit(place: PlaceVisit, trip: Trip | undefined, settings: TravelGachaSettings): TravelCandidate {
  return baseCandidate({
    id: `past:${place.id}`,
    sourceType: 'past_trip',
    sourceId: place.id,
    name: place.name,
    description: place.memo || trip?.title || '過去の訪問場所からの再訪候補です。',
    latitude: place.latitude,
    longitude: place.longitude,
    tags: place.castleId ? ['castle', 'history'] : ['photo'],
    isVisited: true,
    visitCount: 1,
    lastVisitedAt: place.visitedAt?.slice(0, 10) || trip?.endDate,
    sourcePriority: 5,
    settings,
  });
}

function fromCastle(castle: Awaited<ReturnType<typeof repositories.castleMaster.list>>[number], summary: CastleVisitSummary | undefined, settings: TravelGachaSettings): TravelCandidate {
  const isVisited = summary?.status === 'visited';
  return baseCandidate({
    id: `castle:${castle.id}`,
    sourceType: 'castle',
    sourceId: castle.id,
    name: castle.nameJa,
    description: `${castle.series === 'japanese_100_castles' ? '日本100名城' : '続日本100名城'} / ${castle.municipality}`,
    prefectureCode: castle.prefectureCode,
    prefectureName: castle.prefectureName,
    regionCode: castle.region as TravelCandidate['regionCode'],
    latitude: castle.latitude ?? undefined,
    longitude: castle.longitude ?? undefined,
    tags: ['castle', 'history', 'photo'],
    isVisited,
    visitCount: summary?.visitCount ?? 0,
    lastVisitedAt: summary?.lastVisitedAt,
    castleSeries: castle.series,
    sourcePriority: 1,
    settings,
  });
}

function fromCollectionItem(item: CollectionItem, visited: boolean, settings: TravelGachaSettings): TravelCandidate {
  return baseCandidate({
    id: `collection:${item.id}`,
    sourceType: 'collection',
    sourceId: item.id,
    name: item.name,
    description: item.memo || item.address || 'コレクション項目からの候補です。',
    latitude: item.latitude,
    longitude: item.longitude,
    tags: ['collection', 'city_walk'],
    isVisited: visited,
    visitCount: visited ? 1 : 0,
    collectionIds: [item.collectionId],
    sourcePriority: 4,
    settings,
  });
}

function baseCandidate(input: {
  id: string;
  sourceType: TravelCandidate['sourceType'];
  sourceId: string;
  name: string;
  description?: string;
  prefectureCode?: string;
  prefectureName?: string;
  regionCode?: TravelCandidate['regionCode'];
  latitude?: number;
  longitude?: number;
  tags: TravelStyleTag[];
  isVisited: boolean;
  visitCount: number;
  lastVisitedAt?: string;
  isWishlist?: boolean;
  isFavorite?: boolean;
  castleSeries?: TravelCandidate['castleSeries'];
  collectionIds?: string[];
  sourcePriority: number;
  settings: TravelGachaSettings;
}): TravelCandidate {
  const travelTime = estimateTravelTime(input.regionCode, input.prefectureCode, input.settings);
  const stayType = travelTime > 210 ? 'overnight' : input.settings.stayType;
  const costEstimate = estimateCost(travelTime, stayType, input.sourceType);
  return {
    id: input.id,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    name: input.name,
    description: input.description,
    prefectureCode: input.prefectureCode,
    prefectureName: input.prefectureName,
    regionCode: input.regionCode,
    latitude: input.latitude,
    longitude: input.longitude,
    travelStyleTags: input.tags,
    estimatedTravelTimeMinutes: travelTime,
    recommendedTransportModes: recommendTransportModes(travelTime, input.settings.transportModes),
    recommendedStayType: stayType,
    minimumRecommendedHours: stayType === 'dayTrip' ? 4 : 20,
    isVisited: input.isVisited,
    visitCount: input.visitCount,
    lastVisitedAt: input.lastVisitedAt,
    isWishlist: input.isWishlist ?? false,
    isFavorite: input.isFavorite ?? false,
    castleSeries: input.castleSeries,
    collectionIds: input.collectionIds ?? [],
    sourcePriority: input.sourcePriority,
    eligibility: { eligible: true, rejectedReasons: [], suggestions: [] },
    costEstimate,
    score: 10,
    scoreReasons: [],
  };
}

function applyEligibility(
  candidate: TravelCandidate,
  settings: TravelGachaSettings,
  recentDrawCandidateIds: Set<string>,
  rerolledCandidateId?: string,
): TravelCandidate {
  const rejectedReasons: string[] = [];
  const suggestions: string[] = [];
  if (!settings.includeVisited && candidate.isVisited) {
    rejectedReasons.push('訪問済み候補を除外しています。');
    suggestions.push('訪問済みを含める');
  }
  if (!settings.includeRecentlyDrawn && recentDrawCandidateIds.has(candidate.id)) {
    rejectedReasons.push('最近抽選された候補です。');
    suggestions.push('最近抽選済み除外を解除する');
  }
  if (rerolledCandidateId && candidate.id === rerolledCandidateId) {
    rejectedReasons.push('前回結果を一時的に除外しています。');
  }
  if (settings.maxBudget && candidate.costEstimate.minTotalEstimatedCost > settings.maxBudget) {
    rejectedReasons.push('予算超過の可能性があります。');
    suggestions.push('予算を増やす');
  }
  if (settings.maxOneWayTravelMinutes && candidate.estimatedTravelTimeMinutes > settings.maxOneWayTravelMinutes) {
    rejectedReasons.push('移動時間超過の可能性があります。');
    suggestions.push('移動時間を広げる');
  }
  if (settings.candidateScope === 'wishlist' && !candidate.isWishlist) rejectedReasons.push('行きたい場所限定ではありません。');
  if (settings.candidateScope === 'castle' && candidate.sourceType !== 'castle') rejectedReasons.push('城候補ではありません。');
  if (settings.candidateScope === 'visited' && !candidate.isVisited) rejectedReasons.push('再訪候補ではありません。');
  if (settings.regionCodes.length > 0 && candidate.regionCode && !settings.regionCodes.includes(candidate.regionCode)) rejectedReasons.push('指定地方ではありません。');
  if (settings.prefectureCodes.length > 0 && candidate.prefectureCode && !settings.prefectureCodes.includes(candidate.prefectureCode)) rejectedReasons.push('指定都道府県ではありません。');
  if (settings.travelStyleTags.length > 0 && !settings.travelStyleTags.some((tag) => candidate.travelStyleTags.includes(tag))) rejectedReasons.push('指定した旅行タイプと一致しません。');
  return {
    ...candidate,
    eligibility: {
      eligible: rejectedReasons.length === 0,
      rejectedReasons,
      suggestions: [...new Set(suggestions)],
    },
  };
}

function scoreCandidate(candidate: TravelCandidate, settings: TravelGachaSettings): TravelCandidate {
  let score = 20 - candidate.sourcePriority;
  const reasons: string[] = ['条件に合う候補です。'];
  if (!candidate.isVisited && settings.prioritizeUnvisited) {
    score += 30;
    reasons.push('未訪問の候補です。');
  }
  if (candidate.isWishlist && settings.prioritizeWishlist) {
    score += 25;
    reasons.push('行きたい場所に登録されています。');
  }
  if (candidate.sourceType === 'castle' && !candidate.isVisited) {
    score += 20;
    reasons.push('未訪問の城候補です。');
  }
  if (candidate.collectionIds.length > 0 && !candidate.isVisited) {
    score += 12;
    reasons.push('コレクション進行に役立ちます。');
  }
  if (settings.maxBudget) {
    const fit = Math.max(0, settings.maxBudget - candidate.costEstimate.minTotalEstimatedCost);
    if (fit > 0) {
      score += Math.min(15, Math.floor(fit / 2000));
      reasons.push('予算内に収まりやすい概算です。');
    }
  }
  if (settings.maxOneWayTravelMinutes && candidate.estimatedTravelTimeMinutes <= settings.maxOneWayTravelMinutes) {
    score += 10;
    reasons.push('移動時間の条件に合っています。');
  }
  if (candidate.isVisited && candidate.lastVisitedAt) {
    const days = daysSince(candidate.lastVisitedAt);
    if (days > 365) {
      score += 10;
      reasons.push('前回訪問から時間が経っています。');
    } else {
      score -= 8;
      reasons.push('最近訪問した候補です。');
    }
  }
  return { ...candidate, score: Math.max(1, score), scoreReasons: reasons };
}

function pickWeightedCandidate(
  candidates: TravelCandidate[],
  randomnessLevel: TravelGachaRandomnessLevel,
  randomProvider: RandomProvider,
): TravelCandidate | undefined {
  if (candidates.length === 0) return undefined;
  const weights = candidates.map((candidate) => candidateWeight(candidate, randomnessLevel));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = randomProvider.next() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return candidates[index];
  }
  return candidates.at(-1);
}

function candidateWeight(candidate: TravelCandidate, randomnessLevel: TravelGachaRandomnessLevel): number {
  if (randomnessLevel === 'chaos') return 1;
  if (randomnessLevel === 'adventure') return Math.max(1, candidate.score + (candidate.isVisited ? 0 : 30));
  if (randomnessLevel === 'realistic') return Math.max(1, candidate.score ** 1.2);
  return Math.max(1, candidate.score);
}

function validateSettings(settings: TravelGachaSettings): void {
  if (settings.tripDurationDays < 1 || settings.tripDurationDays > 14) throw new Error('旅行日数が不正です。');
  if (settings.maxBudget !== undefined && settings.maxBudget < 0) throw new Error('予算が不正です。');
  if (settings.maxOneWayTravelMinutes !== undefined && settings.maxOneWayTravelMinutes < 0) throw new Error('移動時間が不正です。');
  if (settings.candidateLimit < 1 || settings.candidateLimit > 200) throw new Error('候補数が不正です。');
}

function dedupeCandidates(candidates: TravelCandidate[]): TravelCandidate[] {
  const seen = new Map<string, TravelCandidate>();
  for (const candidate of candidates) {
    const key = candidate.prefectureCode && candidate.name ? `${candidate.prefectureCode}:${candidate.name}` : candidate.id;
    const current = seen.get(key);
    if (!current || candidate.sourcePriority < current.sourcePriority) seen.set(key, candidate);
  }
  return [...seen.values()];
}

function buildSuggestions(candidates: TravelCandidate[]): string[] {
  const rejectedReasons = candidates.flatMap((candidate) => candidate.eligibility.rejectedReasons);
  const suggestions = candidates.flatMap((candidate) => candidate.eligibility.suggestions);
  if (candidates.every((candidate) => !candidate.eligibility.eligible) && rejectedReasons.length > 0) {
    return [...new Set([...suggestions, '地域指定を解除する', '候補範囲を広げる'])].slice(0, 5);
  }
  return [...new Set(suggestions)].slice(0, 5);
}

function estimateTravelTime(regionCode: TravelCandidate['regionCode'], prefectureCode: string | undefined, settings: TravelGachaSettings): number {
  if (settings.departurePrefectureCode && prefectureCode && settings.departurePrefectureCode === prefectureCode) return 60;
  if (settings.regionCodes.length > 0 && regionCode && settings.regionCodes.includes(regionCode)) return 120;
  if (settings.stayType === 'overnight') return 240;
  return 150;
}

function estimateCost(minutes: number, stayType: 'dayTrip' | 'overnight', sourceType: TravelCandidate['sourceType']): TravelCandidateCostEstimate {
  const transportCost = Math.max(1200, Math.round(minutes * 45));
  const accommodationCost = stayType === 'overnight' ? 9000 : 0;
  const foodCost = stayType === 'overnight' ? 4500 : 2500;
  const activityCost = sourceType === 'castle' ? 1200 : 1800;
  const localTransportCost = 1200;
  const contingencyCost = 2000;
  const totalEstimatedCost = transportCost * 2 + accommodationCost + foodCost + activityCost + localTransportCost + contingencyCost;
  return {
    transportCost,
    accommodationCost,
    foodCost,
    activityCost,
    localTransportCost,
    contingencyCost,
    totalEstimatedCost,
    minTotalEstimatedCost: Math.round(totalEstimatedCost * 0.8),
    maxTotalEstimatedCost: Math.round(totalEstimatedCost * 1.25),
    estimatePrecision: 'rough',
    estimateReasons: ['外部経路APIなしの概算です。最新の運賃・宿泊費は確認してください。'],
  };
}

function recommendTransportModes(minutes: number, selected: TravelGachaTransportMode[]): TravelGachaTransportMode[] {
  if (selected.length > 0 && !selected.includes('any')) return selected;
  if (minutes > 240) return ['shinkansen', 'flight', 'train'];
  if (minutes > 120) return ['train', 'car', 'bus'];
  return ['train', 'car', 'bike'];
}

function daysSince(date: string): number {
  return Math.floor((new Date(todayDateInputValue()).getTime() - new Date(`${date}T00:00:00`).getTime()) / 86400000);
}

const MathRandomProvider: RandomProvider = {
  next: () => Math.random(),
};
