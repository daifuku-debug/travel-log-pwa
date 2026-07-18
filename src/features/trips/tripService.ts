import type { EntityId } from '../../domain/models/common';
import type { PlaceVisit, Trip, TripTransportLeg, TripTransportMode, TripType } from '../../domain/models/trip';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { compareDateInputValuesDesc, dateInputToIsoDateTime, isValidDateInputValue } from '../../shared/date/dateUtils';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { linkCastleVisitFromTripPlace, removeTripRelationFromCastle } from '../castles/castleService';
import { grantPlaceVisitExperience, grantTripCompletionExperience, refreshRpgProgress } from '../rpg/rpgProgressService';
import { createTripResultIfNeeded } from '../rpg/tripResultService';

const LOCAL_USER_ID = 'local-user';

export interface TripDetail {
  trip: Trip;
  places: PlaceVisit[];
  transportLegs: TripTransportLeg[];
  transportSummary: TripTransportSummary;
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
  castleId: string;
}

export interface TripTransportLegInput {
  date: string;
  fromName: string;
  toName: string;
  transportMode: TripTransportMode;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: string;
  distanceKm: string;
  oneWayCost: string;
  partyCount: string;
  totalCost: string;
  memo: string;
}

export interface TripTransportSummary {
  legCount: number;
  totalCost: number;
  manualCost: number;
  estimatedCost: number;
  apiCost: number;
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

export function validateTripTransportLegInput(input: TripTransportLegInput): string[] {
  const errors: string[] = [];
  if (!isValidDateInputValue(input.date)) errors.push('移動日を正しく入力してください。');
  if (!input.fromName.trim()) errors.push('出発地を入力してください。');
  if (!input.toName.trim()) errors.push('到着地を入力してください。');
  if (!Number.isFinite(parsePositiveNumber(input.partyCount)) || parsePositiveNumber(input.partyCount) < 1) {
    errors.push('人数は1以上で入力してください。');
  }
  for (const [label, value] of [
    ['所要時間', input.durationMinutes],
    ['距離', input.distanceKm],
    ['片道交通費', input.oneWayCost],
    ['交通費合計', input.totalCost],
  ] as const) {
    if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) errors.push(`${label}は0以上の数値で入力してください。`);
  }
  if (!input.oneWayCost && !input.totalCost) errors.push('片道交通費または交通費合計を入力してください。');
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
    const [places, transportLegs] = await Promise.all([
      repositories.placeVisits.listByTripId(tripId),
      repositories.tripTransportLegs.listByTripId(tripId),
    ]);
    const sortedTransportLegs = sortTransportLegs(transportLegs);
    return {
      trip,
      places: places.slice().sort((a, b) => String(a.visitedAt || '').localeCompare(String(b.visitedAt || ''))),
      transportLegs: sortedTransportLegs,
      transportSummary: summarizeTripTransportLegs(sortedTransportLegs),
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
    const trip = await repositories.trips.save({
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
    await grantTripCompletionExperience(trip);
    await refreshRpgProgress();
    await createTripResultIfNeeded(trip.id);
    return trip;
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
    const trip = await repositories.trips.save({
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
    await grantTripCompletionExperience(trip);
    await refreshRpgProgress();
    return trip;
  } catch (error) {
    throw toAppError(error, '旅行の更新に失敗しました');
  }
}

export async function deleteTrip(tripId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    const places = await repositories.placeVisits.listByTripId(tripId);
    const transportLegs = await repositories.tripTransportLegs.listByTripId(tripId);
    await Promise.all([
      ...places.map((place) => repositories.placeVisits.softDelete(place.id)),
      ...transportLegs.map((leg) => repositories.tripTransportLegs.softDelete(leg.id)),
    ]);
    await repositories.trips.softDelete(tripId);
  } catch (error) {
    throw toAppError(error, '旅行の削除に失敗しました');
  }
}

export async function createTripTransportLeg(tripId: EntityId, input: TripTransportLegInput): Promise<TripTransportLeg> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateTripTransportLegInput(input));
    const trip = await repositories.trips.getById(tripId);
    if (!trip) throw new Error('旅行が見つかりません。');
    const currentLegs = await repositories.tripTransportLegs.listByTripId(tripId);
    const now = new Date().toISOString();
    return repositories.tripTransportLegs.save({
      ...buildTripTransportLegFields(input),
      id: createId('transport-leg'),
      userId: LOCAL_USER_ID,
      tripId,
      costSource: 'manual',
      estimatePrecision: 'exact',
      sortOrder: currentLegs.length + 1,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '移動区間の追加に失敗しました');
  }
}

export async function updateTripTransportLeg(legId: EntityId, input: TripTransportLegInput): Promise<TripTransportLeg> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateTripTransportLegInput(input));
    const current = await repositories.tripTransportLegs.getById(legId);
    if (!current) throw new Error('移動区間が見つかりません。');
    return repositories.tripTransportLegs.save({
      ...current,
      ...buildTripTransportLegFields(input),
      costSource: current.costSource === 'api' ? 'manual' : current.costSource,
      estimatePrecision: 'exact',
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '移動区間の更新に失敗しました');
  }
}

export async function deleteTripTransportLeg(legId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    await repositories.tripTransportLegs.softDelete(legId);
  } catch (error) {
    throw toAppError(error, '移動区間の削除に失敗しました');
  }
}

export async function createPlaceVisit(tripId: EntityId, input: PlaceVisitInput): Promise<PlaceVisit> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validatePlaceVisitInput(input));
    const trip = await repositories.trips.getById(tripId);
    if (!trip) throw new Error('旅行が見つかりません。');
    const now = new Date().toISOString();
    const place = await repositories.placeVisits.save({
      id: createId('place'),
      userId: LOCAL_USER_ID,
      tripId,
      name: input.name.trim(),
      address: optionalText(input.address),
      visitedAt: dateInputToIsoDateTime(input.visitedDate),
      memo: optionalText(input.memo),
      castleId: optionalText(input.castleId),
      collectionItemIds: [],
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    await linkCastleVisitFromTripPlace(place);
    await grantPlaceVisitExperience(place.id, tripId, place.name);
    await refreshRpgProgress();
    return place;
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
    const saved = await repositories.placeVisits.save({
      ...current,
      name: input.name.trim(),
      address: optionalText(input.address),
      visitedAt: dateInputToIsoDateTime(input.visitedDate),
      memo: optionalText(input.memo),
      castleId: optionalText(input.castleId),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
    if (current.castleId && current.castleId !== saved.castleId) {
      await removeTripRelationFromCastle(current);
    }
    await linkCastleVisitFromTripPlace(saved);
    return saved;
  } catch (error) {
    throw toAppError(error, '訪問場所の更新に失敗しました');
  }
}

export async function deletePlaceVisit(placeId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    const current = await repositories.placeVisits.getById(placeId);
    if (current) await removeTripRelationFromCastle(current);
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

function buildTripTransportLegFields(input: TripTransportLegInput): Pick<
  TripTransportLeg,
  | 'date'
  | 'fromName'
  | 'toName'
  | 'transportMode'
  | 'departureTime'
  | 'arrivalTime'
  | 'durationMinutes'
  | 'distanceKm'
  | 'oneWayCost'
  | 'partyCount'
  | 'totalCost'
  | 'memo'
> {
  const partyCount = Math.max(1, Math.round(parsePositiveNumber(input.partyCount) || 1));
  const oneWayCost = optionalNumber(input.oneWayCost);
  const explicitTotalCost = optionalNumber(input.totalCost);
  return {
    date: input.date,
    fromName: input.fromName.trim(),
    toName: input.toName.trim(),
    transportMode: input.transportMode,
    departureTime: optionalText(input.departureTime),
    arrivalTime: optionalText(input.arrivalTime),
    durationMinutes: optionalInteger(input.durationMinutes),
    distanceKm: optionalNumber(input.distanceKm),
    oneWayCost,
    partyCount,
    totalCost: explicitTotalCost ?? Math.round((oneWayCost ?? 0) * partyCount),
    memo: optionalText(input.memo),
  };
}

function summarizeTripTransportLegs(legs: TripTransportLeg[]): TripTransportSummary {
  return legs.reduce<TripTransportSummary>(
    (summary, leg) => ({
      legCount: summary.legCount + 1,
      totalCost: summary.totalCost + leg.totalCost,
      manualCost: summary.manualCost + (leg.costSource === 'manual' ? leg.totalCost : 0),
      estimatedCost: summary.estimatedCost + (leg.costSource === 'estimated' ? leg.totalCost : 0),
      apiCost: summary.apiCost + (leg.costSource === 'api' ? leg.totalCost : 0),
    }),
    { legCount: 0, totalCost: 0, manualCost: 0, estimatedCost: 0, apiCost: 0 },
  );
}

function sortTransportLegs(legs: TripTransportLeg[]): TripTransportLeg[] {
  return legs.slice().sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.sortOrder - b.sortOrder
    || String(a.departureTime || '').localeCompare(String(b.departureTime || '')),
  );
}

function optionalNumber(value: string): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function optionalInteger(value: string): number | undefined {
  const numeric = optionalNumber(value);
  return numeric === undefined ? undefined : Math.round(numeric);
}

function parsePositiveNumber(value: string): number {
  return value ? Number(value) : 1;
}
