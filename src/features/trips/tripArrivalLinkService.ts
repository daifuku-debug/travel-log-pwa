import type { EntityId } from '../../domain/models/common.ts';
import type { PlaceVisit, TripTransportLeg } from '../../domain/models/trip.ts';
import { repositories } from '../../infrastructure/repositories/repositoryFactory.ts';
import {
  createPlaceAndUpdateTransportAtomically,
  updateTripArrivalAtomically,
} from '../../infrastructure/localDb/tripArrivalLinkDataSource.ts';
import { toAppError } from '../../shared/errors.ts';
import { createId } from '../../shared/id.ts';
import { bootstrapAppData } from '../bootstrap/bootstrapService.ts';
import { grantPlaceVisitExperience, refreshRpgProgress } from '../rpg/rpgProgressService.ts';
import { findInProgressPlaceVisits } from './placeVisitDateTime.ts';
import {
  buildLinkedArrivalRecords,
  buildNewPlaceArrivalRecords,
  buildPlaceFromCompletedTransportRecords,
  isTransportDestinationUnregistered,
} from './tripArrivalLink.ts';

const LOCAL_USER_ID = 'local-user';

export async function arriveTransportAndPlaceNow(
  legId: EntityId,
  placeId: EntityId,
  now = new Date(),
): Promise<{ leg: TripTransportLeg; place: PlaceVisit }> {
  try {
    await bootstrapAppData();
    const arrivedAt = assertUsableNow(now);
    return await updateTripArrivalAtomically(
      legId,
      placeId,
      (leg, place) => buildLinkedArrivalRecords(leg, place, arrivedAt),
    );
  } catch (error) {
    throw toAppError(error, error instanceof Error ? error.message : '移動と訪問の到着を記録できませんでした。');
  }
}

export async function createQuickPlaceVisitAndArriveTransport(
  tripId: EntityId,
  legId: EntityId,
  name: string,
  now = new Date(),
): Promise<{ leg: TripTransportLeg; place: PlaceVisit }> {
  try {
    await bootstrapAppData();
    const arrivedAt = assertUsableNow(now);
    const currentPlaces = await repositories.placeVisits.listByTripId(tripId);
    if (findInProgressPlaceVisits(currentPlaces).length > 0) {
      throw new Error('滞在中の場所を出発してから、次の場所を記録してください。');
    }
    if (!name.trim()) throw new Error('場所名を入力してください。');
    const place = createArrivalPlace(tripId, name, arrivedAt);
    const result = await createPlaceAndUpdateTransportAtomically(
      legId,
      place,
      (leg, candidate) => buildNewPlaceArrivalRecords(leg, candidate, arrivedAt),
    );
    await grantPlaceVisitExperience(result.place.id, tripId, result.place.name);
    await refreshRpgProgress();
    return result;
  } catch (error) {
    throw toAppError(error, error instanceof Error ? error.message : '移動と訪問の到着を記録できませんでした。');
  }
}

export async function createPlaceVisitFromTransportArrival(
  legId: EntityId,
): Promise<{ leg: TripTransportLeg; place: PlaceVisit }> {
  try {
    await bootstrapAppData();
    const current = await repositories.tripTransportLegs.getById(legId);
    if (!current) throw new Error('移動区間が見つかりません。');
    if (!current.arrivalAt || !current.toName?.trim()) throw new Error('到着地と到着時刻を確認してください。');
    const currentPlaces = await repositories.placeVisits.listByTripId(current.tripId);
    if (findInProgressPlaceVisits(currentPlaces).length > 0) {
      throw new Error('滞在中の場所を出発してから、次の場所を記録してください。');
    }
    if (!isTransportDestinationUnregistered(current, currentPlaces)) {
      throw new Error('同名の訪問場所があるため、詳細編集で連携先を確認してください。');
    }
    const place = createArrivalPlace(current.tripId, current.toName, current.arrivalAt);
    const result = await createPlaceAndUpdateTransportAtomically(
      legId,
      place,
      (leg, candidate) => buildPlaceFromCompletedTransportRecords(leg, candidate),
    );
    await grantPlaceVisitExperience(result.place.id, result.place.tripId, result.place.name);
    await refreshRpgProgress();
    return result;
  } catch (error) {
    throw toAppError(error, error instanceof Error ? error.message : '訪問場所を追加できませんでした。');
  }
}

function createArrivalPlace(tripId: EntityId, name: string, arrivedAt: string): PlaceVisit {
  return {
    id: createId('place'),
    userId: LOCAL_USER_ID,
    tripId,
    name: name.trim(),
    visitedAt: arrivedAt,
    arrivalAt: arrivedAt,
    collectionItemIds: [],
    createdAt: arrivedAt,
    updatedAt: arrivedAt,
    syncStatus: 'pending',
  };
}

function assertUsableNow(now: Date): string {
  if (Number.isNaN(now.getTime())) throw new Error('到着日時を正しく指定してください。');
  return now.toISOString();
}
