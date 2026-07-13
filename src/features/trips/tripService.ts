import type { EntityId } from '../../domain/models/common';
import type { PlaceVisit, Trip } from '../../domain/models/trip';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { bootstrapAppData } from '../bootstrap/bootstrapService';

export interface TripDetail {
  trip: Trip;
  places: PlaceVisit[];
}

export async function listTrips(): Promise<Trip[]> {
  try {
    await bootstrapAppData();
    return repositories.trips.list();
  } catch (error) {
    throw toAppError(error, '旅行一覧の読み込みに失敗しました');
  }
}

export async function listRecentTrips(limit = 3): Promise<Trip[]> {
  try {
    await bootstrapAppData();
    return repositories.trips.listRecent(limit);
  } catch (error) {
    throw toAppError(error, '最近の旅行の読み込みに失敗しました');
  }
}

export async function getTripDetail(tripId: EntityId): Promise<TripDetail | undefined> {
  try {
    await bootstrapAppData();
    const trip = await repositories.trips.getById(tripId);
    if (!trip) return undefined;
    const places = await repositories.placeVisits.listByTripId(tripId);
    return { trip, places };
  } catch (error) {
    throw toAppError(error, '旅行詳細の読み込みに失敗しました');
  }
}
