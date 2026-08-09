import type { EntityId } from '../../domain/models/common.ts';
import type { PlaceVisit, TripTransportLeg, TripTransportMode } from '../../domain/models/trip.ts';
import { departPlaceAndCreateTransportAtomically } from '../../infrastructure/localDb/tripArrivalLinkDataSource.ts';
import { repositories } from '../../infrastructure/repositories/repositoryFactory.ts';
import { toDateInputValue, toTimeInputValue } from '../../shared/date/dateUtils.ts';
import { toAppError } from '../../shared/errors.ts';
import { createId } from '../../shared/id.ts';
import { bootstrapAppData } from '../bootstrap/bootstrapService.ts';
import { buildDepartureAndTransportRecords } from './currentTripActivity.ts';
import { findInProgressPlaceVisits } from './placeVisitDateTime.ts';
import { findInProgressTransportLegs } from './transportLegDateTime.ts';

const LOCAL_USER_ID = 'local-user';

export interface StartTransportFromPlaceInput {
  transportMode: TripTransportMode;
  toName?: string;
  toPlaceVisitId?: EntityId;
  memo?: string;
}

export async function startTransportFromPlace(
  placeId: EntityId,
  input: StartTransportFromPlaceInput,
  now = new Date(),
): Promise<{ place: PlaceVisit; leg: TripTransportLeg }> {
  try {
    await bootstrapAppData();
    if (Number.isNaN(now.getTime())) throw new Error('出発日時を正しく指定してください。');
    const place = await repositories.placeVisits.getById(placeId);
    if (!place) throw new Error('訪問場所が見つかりません。');
    const destination = input.toPlaceVisitId
      ? await repositories.placeVisits.getById(input.toPlaceVisitId)
      : undefined;
    if (input.toPlaceVisitId && (!destination || destination.tripId !== place.tripId)) {
      throw new Error('到着先の訪問場所を確認してください。');
    }
    const currentLegs = await repositories.tripTransportLegs.listByTripId(place.tripId);
    const timestamp = now.toISOString();
    const leg: TripTransportLeg = {
      id: createId('transport-leg'),
      userId: LOCAL_USER_ID,
      tripId: place.tripId,
      date: toDateInputValue(now),
      fromName: place.name,
      toName: destination?.name ?? (input.toName?.trim() || undefined),
      toPlaceVisitId: destination?.id,
      transportMode: input.transportMode,
      departureTime: toTimeInputValue(now),
      departureAt: timestamp,
      partyCount: 1,
      totalCost: 0,
      costSource: 'manual',
      estimatePrecision: 'exact',
      memo: input.memo?.trim() || undefined,
      sortOrder: currentLegs.length + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };
    return await departPlaceAndCreateTransportAtomically(placeId, leg, buildDepartureAndTransportRecords);
  } catch (error) {
    throw toAppError(error, error instanceof Error ? error.message : '出発と移動開始を記録できませんでした。');
  }
}

export async function arriveExistingPlaceVisitNow(
  placeId: EntityId,
  now = new Date(),
): Promise<PlaceVisit> {
  try {
    await bootstrapAppData();
    if (Number.isNaN(now.getTime())) throw new Error('到着日時を正しく指定してください。');
    const place = await repositories.placeVisits.getById(placeId);
    if (!place) throw new Error('訪問場所が見つかりません。');
    if (place.arrivalAt || place.departureAt) throw new Error('この訪問場所にはすでに時刻が記録されています。');
    const [places, legs] = await Promise.all([
      repositories.placeVisits.listByTripId(place.tripId),
      repositories.tripTransportLegs.listByTripId(place.tripId),
    ]);
    if (findInProgressPlaceVisits(places).length > 0 || findInProgressTransportLegs(legs).length > 0) {
      throw new Error('現在の滞在または移動を終えてから記録してください。');
    }
    const timestamp = now.toISOString();
    return await repositories.placeVisits.save({
      ...place,
      visitedAt: timestamp,
      arrivalAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, error instanceof Error ? error.message : '到着を記録できませんでした。');
  }
}
