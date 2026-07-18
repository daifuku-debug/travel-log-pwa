import type { Trip } from '../../domain/models/trip';
import experienceRules from '../../domain/rpg/experienceRules.json';
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

  await Promise.all(trips.map((trip) => grantTripCompletionExperience(trip)));
  await Promise.all(places.map((place) => grantPlaceVisitExperience(place.id, place.tripId, place.name)));
  await Promise.all(
    prefectureVisits.map((visit) =>
      grantPrefectureExperience(visit.prefectureCode, visit.status, visit.visitCount),
    ),
  );
  await Promise.all(
    collectionVisits.map((visit) =>
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
