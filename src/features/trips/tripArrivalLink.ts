import type { PlaceVisit, TripTransportLeg } from '../../domain/models/trip.ts';
import { isoDateTimeToTimeInput } from '../../shared/date/dateUtils.ts';

export type TransportArrivalVisitCandidate =
  | { kind: 'linked'; place: PlaceVisit; canRecordArrival: true }
  | { kind: 'linked'; place: PlaceVisit; canRecordArrival: false; reason: 'already-arrived' | 'time-conflict' }
  | { kind: 'suggested'; place: PlaceVisit; canRecordArrival: true }
  | { kind: 'suggested'; place: PlaceVisit; canRecordArrival: false; reason: 'already-arrived' | 'time-conflict' }
  | { kind: 'unregistered'; suggestedName?: string };

export interface LinkedArrivalRecords {
  leg: TripTransportLeg;
  place: PlaceVisit;
}

export function resolveTransportArrivalVisitCandidate(
  leg: TripTransportLeg,
  places: readonly PlaceVisit[],
  arrivedAt: string,
): TransportArrivalVisitCandidate {
  if (!leg.toPlaceVisitId) {
    const matchingPlaces = places.filter((candidate) =>
      candidate.tripId === leg.tripId
      && normalizePlaceName(candidate.name) === normalizePlaceName(leg.toName),
    );
    if (matchingPlaces.length !== 1) return { kind: 'unregistered', suggestedName: leg.toName };
    return describeCandidate('suggested', matchingPlaces[0], arrivedAt);
  }
  const place = places.find((candidate) => candidate.id === leg.toPlaceVisitId && candidate.tripId === leg.tripId);
  if (!place) return { kind: 'unregistered', suggestedName: leg.toName };
  return describeCandidate('linked', place, arrivedAt);
}

export function isReverseTransportArrivalCandidate(
  leg: TripTransportLeg,
  placeName: string,
): boolean {
  return Boolean(
    leg.departureAt
    && !leg.arrivalAt
    && !leg.toPlaceVisitId
    && normalizePlaceName(leg.toName) === normalizePlaceName(placeName),
  );
}

export function isTransportDestinationUnregistered(
  leg: TripTransportLeg,
  places: readonly PlaceVisit[],
): boolean {
  if (!leg.toName?.trim() || leg.toPlaceVisitId) return false;
  return !places.some((place) =>
    place.tripId === leg.tripId
    && normalizePlaceName(place.name) === normalizePlaceName(leg.toName),
  );
}

export function buildLinkedArrivalRecords(
  leg: TripTransportLeg,
  place: PlaceVisit,
  arrivedAt: string,
): LinkedArrivalRecords {
  assertValidArrivalTimestamp(arrivedAt);
  if (leg.tripId !== place.tripId) throw new Error('同じ旅行の移動と訪問だけを連携できます。');
  if (leg.toPlaceVisitId && leg.toPlaceVisitId !== place.id) throw new Error('移動区間の到着先が変更されています。');
  if (!leg.toPlaceVisitId && normalizePlaceName(leg.toName) !== normalizePlaceName(place.name)) {
    throw new Error('移動区間の到着先が変更されています。');
  }
  if (leg.arrivalAt && place.arrivalAt && leg.arrivalAt === arrivedAt && place.arrivalAt === arrivedAt) {
    return { leg, place };
  }
  if (leg.arrivalAt) throw new Error('この移動にはすでに到着時刻があります。');
  if (!leg.departureAt || arrivedAt < leg.departureAt) throw new Error('到着日時は出発日時以降にしてください。');
  if (place.arrivalAt) throw new Error('この訪問場所にはすでに到着時刻があります。');
  if (place.departureAt && arrivedAt > place.departureAt) throw new Error('訪問の出発日時より後には到着を記録できません。');

  return {
    leg: applyTransportArrival({ ...leg, toPlaceVisitId: place.id }, arrivedAt),
    place: applyPlaceArrival(place, arrivedAt),
  };
}

export function buildExplicitLinkedArrivalRecords(
  leg: TripTransportLeg,
  place: PlaceVisit,
  arrivedAt: string,
): LinkedArrivalRecords {
  assertValidArrivalTimestamp(arrivedAt);
  if (leg.tripId !== place.tripId) throw new Error('同じ旅行の移動と訪問だけを連携できます。');
  if (leg.toPlaceVisitId && leg.toPlaceVisitId !== place.id) {
    throw new Error('移動区間の到着先が変更されています。');
  }
  if (leg.arrivalAt) throw new Error('この移動にはすでに到着時刻があります。');
  if (!leg.departureAt || arrivedAt < leg.departureAt) throw new Error('到着日時は出発日時以降にしてください。');
  if (place.arrivalAt) throw new Error('この訪問場所にはすでに到着時刻があります。');
  if (place.departureAt && arrivedAt > place.departureAt) throw new Error('訪問の出発日時より後には到着を記録できません。');
  return {
    leg: applyTransportArrival({ ...leg, toName: place.name, toPlaceVisitId: place.id }, arrivedAt),
    place: applyPlaceArrival(place, arrivedAt),
  };
}

export function buildNewPlaceArrivalRecords(
  leg: TripTransportLeg,
  place: PlaceVisit,
  arrivedAt: string,
): LinkedArrivalRecords {
  assertValidArrivalTimestamp(arrivedAt);
  if (leg.tripId !== place.tripId) throw new Error('同じ旅行の移動と訪問だけを連携できます。');
  if (leg.arrivalAt) throw new Error('この移動にはすでに到着時刻があります。');
  if (leg.toPlaceVisitId) throw new Error('移動区間にはすでに訪問場所が設定されています。');
  if (!isReverseTransportArrivalCandidate(leg, place.name)) throw new Error('移動の到着先と訪問場所を確認してください。');
  if (!leg.departureAt || arrivedAt < leg.departureAt) throw new Error('到着日時は出発日時以降にしてください。');

  return {
    leg: applyTransportArrival({ ...leg, toPlaceVisitId: place.id }, arrivedAt),
    place,
  };
}

export function buildExplicitNewPlaceArrivalRecords(
  leg: TripTransportLeg,
  place: PlaceVisit,
  arrivedAt: string,
): LinkedArrivalRecords {
  assertValidArrivalTimestamp(arrivedAt);
  if (leg.tripId !== place.tripId) throw new Error('同じ旅行の移動と訪問だけを連携できます。');
  if (leg.arrivalAt) throw new Error('この移動にはすでに到着時刻があります。');
  if (leg.toPlaceVisitId) throw new Error('移動区間にはすでに訪問場所が設定されています。');
  if (!leg.departureAt || arrivedAt < leg.departureAt) throw new Error('到着日時は出発日時以降にしてください。');
  return {
    leg: applyTransportArrival({ ...leg, toName: place.name, toPlaceVisitId: place.id }, arrivedAt),
    place,
  };
}

export function buildPlaceFromCompletedTransportRecords(
  leg: TripTransportLeg,
  place: PlaceVisit,
): LinkedArrivalRecords {
  if (!leg.arrivalAt) throw new Error('移動の到着時刻がありません。');
  if (leg.toPlaceVisitId) throw new Error('この移動にはすでに訪問場所が設定されています。');
  if (!leg.toName?.trim()) throw new Error('到着地が未設定です。');
  if (leg.tripId !== place.tripId) throw new Error('同じ旅行の移動と訪問だけを連携できます。');
  return {
    leg: { ...leg, toPlaceVisitId: place.id, updatedAt: leg.arrivalAt, syncStatus: 'pending' },
    place,
  };
}

function applyTransportArrival(leg: TripTransportLeg, arrivedAt: string): TripTransportLeg {
  const durationMinutes = Math.max(0, Math.round((Date.parse(arrivedAt) - Date.parse(leg.departureAt!)) / 60_000));
  return {
    ...leg,
    arrivalAt: arrivedAt,
    arrivalTime: isoDateTimeToTimeInput(arrivedAt),
    durationMinutes: leg.durationMinutes ?? durationMinutes,
    updatedAt: arrivedAt,
    syncStatus: 'pending',
  };
}

function applyPlaceArrival(place: PlaceVisit, arrivedAt: string): PlaceVisit {
  return {
    ...place,
    visitedAt: arrivedAt,
    arrivalAt: arrivedAt,
    updatedAt: arrivedAt,
    syncStatus: 'pending',
  };
}

function normalizePlaceName(value?: string): string {
  return value?.trim().normalize('NFKC').toLocaleLowerCase('ja-JP') ?? '';
}

function describeCandidate(
  kind: 'linked' | 'suggested',
  place: PlaceVisit,
  arrivedAt: string,
): Exclude<TransportArrivalVisitCandidate, { kind: 'unregistered' }> {
  if (place.arrivalAt) return { kind, place, canRecordArrival: false, reason: 'already-arrived' };
  if (place.departureAt && arrivedAt > place.departureAt) {
    return { kind, place, canRecordArrival: false, reason: 'time-conflict' };
  }
  return { kind, place, canRecordArrival: true };
}

function assertValidArrivalTimestamp(value: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error('到着日時を正しく指定してください。');
}
