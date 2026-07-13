import type { EntityId } from '../../domain/models/common';
import type { PlaceVisit, Trip, TripType } from '../../domain/models/trip';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { compareDateInputValuesDesc, dateInputToIsoDateTime, isValidDateInputValue } from '../../shared/date/dateUtils';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { bootstrapAppData } from '../bootstrap/bootstrapService';

const LOCAL_USER_ID = 'local-user';

export interface TripDetail {
  trip: Trip;
  places: PlaceVisit[];
}

export interface TripInput {
  title: string;
  startDate: string;
  endDate: string;
  tripType: TripType;
  companionsText: string;
  purpose: string;
  memo: string;
}

export interface PlaceVisitInput {
  name: string;
  address: string;
  visitedDate: string;
  memo: string;
}

export function validateTripInput(input: TripInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('タイトルを入力してください。');
  if (!isValidDateInputValue(input.startDate)) errors.push('開始日を正しく入力してください。');
  if (!isValidDateInputValue(input.endDate)) errors.push('終了日を正しく入力してください。');
  if (isValidDateInputValue(input.startDate) && isValidDateInputValue(input.endDate) && input.endDate < input.startDate) {
    errors.push('終了日は開始日以降にしてください。');
  }
  return errors;
}

export function validatePlaceVisitInput(input: PlaceVisitInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('場所名を入力してください。');
  if (input.visitedDate && !isValidDateInputValue(input.visitedDate)) {
    errors.push('訪問日を正しく入力してください。');
  }
  return errors;
}

export async function listTrips(): Promise<Trip[]> {
  try {
    await bootstrapAppData();
    const trips = await repositories.trips.list();
    return trips.slice().sort((a, b) => compareDateInputValuesDesc(a.startDate, b.startDate));
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
    return {
      trip,
      places: places.slice().sort((a, b) => String(a.visitedAt || '').localeCompare(String(b.visitedAt || ''))),
    };
  } catch (error) {
    throw toAppError(error, '旅行詳細の読み込みに失敗しました');
  }
}

export async function createTrip(input: TripInput): Promise<Trip> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateTripInput(input));
    const now = new Date().toISOString();
    return repositories.trips.save({
      id: createId('trip'),
      userId: LOCAL_USER_ID,
      title: input.title.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      tripType: input.tripType,
      companions: parseCompanions(input.companionsText),
      purpose: optionalText(input.purpose),
      memo: optionalText(input.memo),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '旅行の作成に失敗しました');
  }
}

export async function updateTrip(tripId: EntityId, input: TripInput): Promise<Trip> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateTripInput(input));
    const current = await repositories.trips.getById(tripId);
    if (!current) throw new Error('旅行が見つかりません。');
    return repositories.trips.save({
      ...current,
      title: input.title.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      tripType: input.tripType,
      companions: parseCompanions(input.companionsText),
      purpose: optionalText(input.purpose),
      memo: optionalText(input.memo),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '旅行の更新に失敗しました');
  }
}

export async function deleteTrip(tripId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    const places = await repositories.placeVisits.listByTripId(tripId);
    await Promise.all(places.map((place) => repositories.placeVisits.softDelete(place.id)));
    await repositories.trips.softDelete(tripId);
  } catch (error) {
    throw toAppError(error, '旅行の削除に失敗しました');
  }
}

export async function createPlaceVisit(tripId: EntityId, input: PlaceVisitInput): Promise<PlaceVisit> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validatePlaceVisitInput(input));
    const trip = await repositories.trips.getById(tripId);
    if (!trip) throw new Error('旅行が見つかりません。');
    const now = new Date().toISOString();
    return repositories.placeVisits.save({
      id: createId('place'),
      userId: LOCAL_USER_ID,
      tripId,
      name: input.name.trim(),
      address: optionalText(input.address),
      visitedAt: dateInputToIsoDateTime(input.visitedDate),
      memo: optionalText(input.memo),
      collectionItemIds: [],
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '訪問場所の追加に失敗しました');
  }
}

export async function updatePlaceVisit(placeId: EntityId, input: PlaceVisitInput): Promise<PlaceVisit> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validatePlaceVisitInput(input));
    const current = await repositories.placeVisits.getById(placeId);
    if (!current) throw new Error('訪問場所が見つかりません。');
    return repositories.placeVisits.save({
      ...current,
      name: input.name.trim(),
      address: optionalText(input.address),
      visitedAt: dateInputToIsoDateTime(input.visitedDate),
      memo: optionalText(input.memo),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '訪問場所の更新に失敗しました');
  }
}

export async function deletePlaceVisit(placeId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    await repositories.placeVisits.softDelete(placeId);
  } catch (error) {
    throw toAppError(error, '訪問場所の削除に失敗しました');
  }
}

function assertNoValidationErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function parseCompanions(value: string): string[] {
  return value
    .split(/[\n,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}
