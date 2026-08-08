import type { EntityId } from '../../domain/models/common.ts';
import type { PlaceVisit, TripTransportLeg } from '../../domain/models/trip.ts';
import { AppError } from '../../shared/errors.ts';
import { getLocalDb } from './db.ts';

export async function updateTripArrivalAtomically(
  legId: EntityId,
  placeId: EntityId,
  update: (leg: TripTransportLeg, place: PlaceVisit) => { leg: TripTransportLeg; place: PlaceVisit },
): Promise<{ leg: TripTransportLeg; place: PlaceVisit }> {
  const db = await getLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tripTransportLegs', 'placeVisits'], 'readwrite');
    const legStore = transaction.objectStore('tripTransportLegs');
    const placeStore = transaction.objectStore('placeVisits');
    const legRequest = legStore.get(legId);
    const placeRequest = placeStore.get(placeId);
    let result: { leg: TripTransportLeg; place: PlaceVisit } | undefined;
    let legReady = false;
    let placeReady = false;

    function applyWhenReady() {
      if (!legReady || !placeReady || result) return;
      try {
        const leg = legRequest.result as TripTransportLeg | undefined;
        const place = placeRequest.result as PlaceVisit | undefined;
        if (!leg || !place) throw new Error('連携対象が見つかりません。');
        if (leg.deletedAt || place.deletedAt) throw new Error('連携対象が見つかりません。');
        result = update(leg, place);
        legStore.put(result.leg);
        placeStore.put(result.place);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    }

    legRequest.onsuccess = () => {
      legReady = true;
      applyWhenReady();
    };
    placeRequest.onsuccess = () => {
      placeReady = true;
      applyWhenReady();
    };
    transaction.oncomplete = () => result
      ? resolve(result)
      : reject(new AppError('連携対象が見つかりません。'));
    transaction.onerror = () => reject(new AppError('到着記録を保存できませんでした', transaction.error));
    transaction.onabort = () => {
      if (!result) reject(new AppError('到着記録を保存できませんでした', transaction.error));
    };
  });
}

export async function createPlaceAndUpdateTransportAtomically(
  legId: EntityId,
  place: PlaceVisit,
  update: (leg: TripTransportLeg, place: PlaceVisit) => { leg: TripTransportLeg; place: PlaceVisit },
): Promise<{ leg: TripTransportLeg; place: PlaceVisit }> {
  const db = await getLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tripTransportLegs', 'placeVisits'], 'readwrite');
    const legStore = transaction.objectStore('tripTransportLegs');
    const placeStore = transaction.objectStore('placeVisits');
    const legRequest = legStore.get(legId);
    const existingPlaceRequest = placeStore.get(place.id);
    let result: { leg: TripTransportLeg; place: PlaceVisit } | undefined;
    let legReady = false;
    let placeReady = false;

    function applyWhenReady() {
      if (!legReady || !placeReady || result) return;
      try {
        const leg = legRequest.result as TripTransportLeg | undefined;
        if (!leg) throw new Error('連携対象が見つかりません。');
        if (leg.deletedAt || existingPlaceRequest.result) throw new Error('連携対象の状態が変更されています。');
        result = update(leg, place);
        legStore.put(result.leg);
        placeStore.put(result.place);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    }

    legRequest.onsuccess = () => {
      legReady = true;
      applyWhenReady();
    };
    existingPlaceRequest.onsuccess = () => {
      placeReady = true;
      applyWhenReady();
    };
    transaction.oncomplete = () => result
      ? resolve(result)
      : reject(new AppError('連携対象が見つかりません。'));
    transaction.onerror = () => reject(new AppError('到着記録を保存できませんでした', transaction.error));
    transaction.onabort = () => {
      if (!result) reject(new AppError('到着記録を保存できませんでした', transaction.error));
    };
  });
}
