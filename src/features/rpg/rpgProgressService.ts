import type { Trip } from '../../domain/models/trip';
import experienceRules from '../../domain/rpg/experienceRules.json';
import { clearStore } from '../../infrastructure/localDb/db';
import {
  SAMPLE_COLLECTION_VISIT_IDS,
  SAMPLE_COLLECTION_IDS,
  SAMPLE_COLLECTION_ITEM_IDS,
  SAMPLE_PLACE_VISIT_IDS,
  SAMPLE_TRIP_IDS,
  SAMPLE_WISHLIST_ITEM_IDS,
} from '../../infrastructure/localDb/sampleData';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { refreshAchievements } from './achievementService';
import { grantExperienceOnce } from './experienceService';
import { refreshQuests } from './questService';
import { calculateLevelProgress } from './rpgLevel';
import { CURRENT_RPG_MIGRATION_VERSION, getRpgSettings } from './rpgSettingsService';
import { getTravelStats } from './rpgStatsService';
import { refreshTitles } from './titleService';

export async function ensureRpgProgressInitialized(): Promise<void> {
  try {
    await bootstrapAppData();
    const settings = await getRpgSettings();
    await cleanupSampleOnlyRpgProgress();
    if (settings.initialAggregationCompletedAt) {
      await refreshRpgProgress();
      return;
    }

    if (settings.includeExistingDataInInitialAggregation) {
      await grantExistingDataExperience();
    }
    await refreshRpgProgress();
    await repositories.rpgSettings.save({
      ...settings,
      rpgMigrationVersion: CURRENT_RPG_MIGRATION_VERSION,
      initialAggregationCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '旅行RPGの初期集計に失敗しました');
  }
}

export async function refreshRpgProgress() {
  const stats = await getTravelStats();
  const [achievements, titles, quests] = await Promise.all([
    refreshAchievements(stats),
    refreshTitles(stats),
    refreshQuests(stats),
  ]);
  const entries = await repositories.rpgExperienceEntries.list();
  return {
    stats,
    achievements,
    titles,
    quests,
    level: calculateLevelProgress(entries),
  };
}

export async function grantTripCompletionExperience(trip: Trip): Promise<void> {
  await grantExperienceOnce({
    amount: experienceRules.tripCompleted,
    sourceType: 'trip',
    sourceId: trip.id,
    sourceKey: `trip-completed:${trip.id}`,
    reason: `${trip.title} を完了`,
    metadata: { tripId: trip.id },
  });
  await grantExperienceOnce({
    amount: trip.tripType === 'dayTrip' ? experienceRules.dayTripBonus : experienceRules.overnightTripBonus,
    sourceType: 'trip',
    sourceId: trip.id,
    sourceKey: `trip-type-bonus:${trip.id}:${trip.tripType}`,
    reason: `${trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}旅行ボーナス`,
    metadata: { tripId: trip.id, tripType: trip.tripType },
  });
  if (trip.memo) {
    await grantExperienceOnce({
      amount: experienceRules.tripMemo,
      sourceType: 'trip',
      sourceId: trip.id,
      sourceKey: `trip-memo:${trip.id}`,
      reason: `${trip.title} にメモを記録`,
      metadata: { tripId: trip.id },
    });
  }
}

export async function grantPlaceVisitExperience(placeId: string, tripId: string, placeName: string): Promise<void> {
  await grantExperienceOnce({
    amount: experienceRules.placeVisit,
    sourceType: 'trip',
    sourceId: placeId,
    sourceKey: `travel-location-added:${placeId}`,
    reason: `${placeName} を訪問場所に追加`,
    metadata: { placeId, tripId },
  });
}

export async function grantPrefectureExperience(
  prefectureCode: string,
  status: 'unvisited' | 'passed' | 'visited' | 'stayed',
  visitCount: number,
): Promise<void> {
  if (status === 'unvisited' || status === 'passed') return;
  await grantExperienceOnce({
    amount: experienceRules.prefectureFirstVisit,
    sourceType: 'prefecture',
    sourceId: prefectureCode,
    sourceKey: `prefecture-first-visit:${prefectureCode}`,
    reason: `${prefectureCode} を初訪問`,
    metadata: { prefectureCode, status },
  });
  if (status === 'stayed') {
    await grantExperienceOnce({
      amount: experienceRules.prefectureFirstStay,
      sourceType: 'prefecture',
      sourceId: prefectureCode,
      sourceKey: `prefecture-first-stay:${prefectureCode}`,
      reason: `${prefectureCode} に初宿泊`,
      metadata: { prefectureCode, status },
    });
  }
  if (visitCount > 1) {
    await grantExperienceOnce({
      amount: experienceRules.prefectureRevisit,
      sourceType: 'prefecture',
      sourceId: prefectureCode,
      sourceKey: `prefecture-revisit:${prefectureCode}:${visitCount}`,
      reason: `${prefectureCode} を再訪`,
      metadata: { prefectureCode, visitCount },
    });
  }
}

async function grantExistingDataExperience(): Promise<void> {
  const [trips, places, prefectureVisits, collectionVisits, collections] = await Promise.all([
    repositories.trips.list(),
    repositories.placeVisits.list(),
    repositories.prefectureVisits.list(),
    repositories.collectionVisits.list(),
    repositories.collections.listWithProgress(),
  ]);

  await Promise.all(
    trips
      .filter((trip) => !SAMPLE_TRIP_IDS.includes(trip.id))
      .map((trip) => grantTripCompletionExperience(trip)),
  );
  await Promise.all(
    places
      .filter((place) => !SAMPLE_PLACE_VISIT_IDS.includes(place.id))
      .map((place) => grantPlaceVisitExperience(place.id, place.tripId, place.name)),
  );
  await Promise.all(
    prefectureVisits.map((visit) =>
      grantPrefectureExperience(visit.prefectureCode, visit.status, visit.visitCount),
    ),
  );
  await Promise.all(
    collectionVisits.filter((visit) => !SAMPLE_COLLECTION_VISIT_IDS.includes(visit.id)).map((visit) =>
      grantExperienceOnce({
        amount: experienceRules.collectionItemCompleted,
        sourceType: 'collection',
        sourceId: visit.collectionItemId,
        sourceKey: `collection-completed:${visit.collectionItemId}`,
        reason: 'コレクション項目を達成',
        metadata: { collectionItemId: visit.collectionItemId },
      }),
    ),
  );

  for (const collection of collections) {
    if (collection.totalCount <= 0) continue;
    const rate = (collection.visitedCount / collection.totalCount) * 100;
    for (const [threshold, amount] of Object.entries(experienceRules.collectionMilestones)) {
      if (rate >= Number(threshold)) {
        await grantExperienceOnce({
          amount,
          sourceType: 'collection',
          sourceId: collection.id,
          sourceKey: `collection-milestone:${collection.id}:${threshold}`,
          reason: `${collection.name} ${threshold}%達成`,
          metadata: { collectionId: collection.id, threshold },
        });
      }
    }
  }

  const visitedPrefectureCount = prefectureVisits.filter((visit) => visit.status === 'visited' || visit.status === 'stayed').length;
  for (const [threshold, amount] of Object.entries(experienceRules.japanConquestMilestones)) {
    if (visitedPrefectureCount >= Number(threshold)) {
      await grantExperienceOnce({
        amount,
        sourceType: 'prefecture',
        sourceKey: `japan-conquest:${threshold}`,
        reason: `日本${threshold}都道府県達成`,
        metadata: { threshold },
      });
    }
  }
}

async function cleanupSampleOnlyRpgProgress(): Promise<void> {
  const [trips, places, prefectureVisits, collectionVisits, wishlist, entries, titles, achievements] = await Promise.all([
    repositories.trips.list(),
    repositories.placeVisits.list(),
    repositories.prefectureVisits.list(),
    repositories.collectionVisits.list(),
    repositories.wishlist.list(),
    repositories.rpgExperienceEntries.list(),
    repositories.userRpgTitles.list(),
    repositories.userRpgAchievements.list(),
  ]);
  if (entries.length === 0 && titles.length === 0 && achievements.length === 0) return;
  await Promise.all(
    entries
      .filter((entry) => isSampleExperienceSourceKey(entry.sourceKey))
      .map((entry) => repositories.rpgExperienceEntries.softDelete(entry.id)),
  );
  const hasUserData =
    trips.some((trip) => !SAMPLE_TRIP_IDS.includes(trip.id)) ||
    places.some((place) => !SAMPLE_PLACE_VISIT_IDS.includes(place.id)) ||
    prefectureVisits.length > 0 ||
    collectionVisits.some((visit) => !SAMPLE_COLLECTION_VISIT_IDS.includes(visit.id)) ||
    wishlist.some((item) => !SAMPLE_WISHLIST_ITEM_IDS.includes(item.id));

  if (hasUserData) return;

  await Promise.all([
    clearStore('rpgExperienceEntries'),
    clearStore('userRpgTitles'),
    clearStore('userRpgAchievements'),
    clearStore('rpgQuests'),
    clearStore('tripRpgResults'),
  ]);
}

function isSampleExperienceSourceKey(sourceKey: string): boolean {
  return (
    SAMPLE_TRIP_IDS.some((tripId) =>
      sourceKey === `trip-completed:${tripId}` ||
      sourceKey === `trip-memo:${tripId}` ||
      sourceKey.startsWith(`trip-type-bonus:${tripId}:`),
    ) ||
    SAMPLE_PLACE_VISIT_IDS.some((placeId) => sourceKey === `travel-location-added:${placeId}`) ||
    SAMPLE_COLLECTION_ITEM_IDS.some((itemId) => sourceKey === `collection-completed:${itemId}`) ||
    SAMPLE_COLLECTION_IDS.some((collectionId) => sourceKey.startsWith(`collection-milestone:${collectionId}:`))
  );
}
