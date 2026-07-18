import type { EntityId } from '../../domain/models/common';
import type { TripRpgResult } from '../../domain/models/rpg';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { calculateLevelProgress } from './rpgLevel';

const LOCAL_USER_ID = 'local-user';

export interface TripRpgResultView {
  result: TripRpgResult;
  tripTitle: string;
  tripPeriod: string;
  tripTypeLabel: string;
  nextLevelExp: number;
}

export async function createTripResultIfNeeded(tripId: EntityId): Promise<TripRpgResult | undefined> {
  try {
    const existing = await repositories.tripRpgResults.getByTripId(tripId);
    if (existing) return existing;
    const trip = await repositories.trips.getById(tripId);
    if (!trip) return undefined;
    const places = await repositories.placeVisits.listByTripId(tripId);
    const entries = await repositories.rpgExperienceEntries.list();
    const beforeEntries = entries.filter((entry) => entry.metadata?.tripId !== tripId);
    const tripEntries = entries.filter((entry) => entry.metadata?.tripId === tripId);
    const beforeLevel = calculateLevelProgress(beforeEntries);
    const afterLevel = calculateLevelProgress(entries);
    const now = new Date().toISOString();
    return repositories.tripRpgResults.save({
      id: createId('trip-result'),
      userId: LOCAL_USER_ID,
      tripId,
      generatedAt: now,
      expEntryIds: tripEntries.map((entry) => entry.id),
      totalExp: tripEntries.reduce((sum, entry) => sum + entry.amount, 0),
      oldLevel: beforeLevel.currentLevel,
      newLevel: afterLevel.currentLevel,
      unlockedAchievementIds: [],
      unlockedTitleIds: [],
      progressedQuestIds: [],
      summary: {
        placeVisitCount: places.length,
        newPrefectureCodes: [],
        firstStayedPrefectureCodes: [],
        collectionVisitCount: 0,
      },
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '旅行リザルトの作成に失敗しました');
  }
}

export async function getTripResultView(tripId: EntityId): Promise<TripRpgResultView | undefined> {
  try {
    const trip = await repositories.trips.getById(tripId);
    if (!trip) return undefined;
    const result = await repositories.tripRpgResults.getByTripId(tripId);
    if (!result) return undefined;
    const entries = await repositories.rpgExperienceEntries.list();
    const level = calculateLevelProgress(entries);
    return {
      result,
      tripTitle: trip.title,
      tripPeriod: `${trip.startDate} - ${trip.endDate}`,
      tripTypeLabel: trip.tripType === 'dayTrip' ? '日帰り' : '宿泊',
      nextLevelExp: level.expToNextLevel,
    };
  } catch (error) {
    throw toAppError(error, '旅行リザルトの読み込みに失敗しました');
  }
}
