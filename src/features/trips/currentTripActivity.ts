import type { PlaceVisit, TripTransportLeg } from '../../domain/models/trip.ts';
import { isPlaceVisitInProgress } from './placeVisitDateTime.ts';
import { findInProgressTransportLegs, isTransportLegInProgress } from './transportLegDateTime.ts';

export type CurrentTripActivity =
  | { kind: 'idle' }
  | { kind: 'staying'; place: PlaceVisit }
  | { kind: 'moving'; leg: TripTransportLeg }
  | { kind: 'conflict'; places: PlaceVisit[]; legs: TripTransportLeg[] };

export function resolveCurrentTripActivity(
  places: readonly PlaceVisit[],
  transportLegs: readonly TripTransportLeg[],
): CurrentTripActivity {
  const activePlaces = places.filter((place) => !place.deletedAt && isPlaceVisitInProgress(place));
  const activeLegs = transportLegs.filter((leg) => !leg.deletedAt && isTransportLegInProgress(leg));

  if (activePlaces.length === 0 && activeLegs.length === 0) return { kind: 'idle' };
  if (activePlaces.length === 1 && activeLegs.length === 0) return { kind: 'staying', place: activePlaces[0] };
  if (activePlaces.length === 0 && activeLegs.length === 1) return { kind: 'moving', leg: activeLegs[0] };
  return { kind: 'conflict', places: activePlaces, legs: activeLegs };
}

export function buildDepartureAndTransportRecords(
  place: PlaceVisit,
  currentLegs: TripTransportLeg[],
  leg: TripTransportLeg,
): { place: PlaceVisit; leg: TripTransportLeg } {
  if (place.tripId !== leg.tripId || place.deletedAt) throw new Error('出発場所を確認してください。');
  if (!place.arrivalAt || place.departureAt) throw new Error('滞在中の場所からのみ移動を開始できます。');
  if (leg.departureAt! < place.arrivalAt) throw new Error('出発日時は到着日時以降にしてください。');
  if (findInProgressTransportLegs(currentLegs).length > 0) {
    throw new Error('移動中の区間を到着済みにしてから、次の移動を記録してください。');
  }
  return {
    place: { ...place, departureAt: leg.departureAt, updatedAt: leg.departureAt!, syncStatus: 'pending' },
    leg,
  };
}
