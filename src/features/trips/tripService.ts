import type { EntityId } from '../../domain/models/common';
import type { ManualTimelineEntry } from '../../domain/models/timeMachine.ts';
import type { PlaceVisit, Trip, TripTransportLeg, TripTransportMode, TripType } from '../../domain/models/trip';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import {
  compareDateInputValuesDesc,
  isValidDateInputValue,
  isoDateTimeToDateInput,
  isoDateTimeToTimeInput,
} from '../../shared/date/dateUtils';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { linkCastleVisitFromTripPlace, removeTripRelationFromCastle } from '../castles/castleService';
import { grantPlaceVisitExperience, grantTripCompletionExperience, refreshRpgProgress } from '../rpg/rpgProgressService';
import { createTripResultIfNeeded } from '../rpg/tripResultService';
import {
  buildPlaceVisitDateTimeFields,
  createArrivalNowInput,
  createDepartureNowInput,
  findInProgressPlaceVisits,
  validatePlaceVisitDateTimeInput,
} from './placeVisitDateTime.ts';
import { isQuickTravelRecord } from './quickTravelRecord.ts';
import {
  buildTransportLegDateTimeFields,
  createTransportArrivalNowInput,
  createTransportDepartureNowInput,
  findInProgressTransportLegs,
  validateTransportLegDateTimeInput,
} from './transportLegDateTime.ts';

const LOCAL_USER_ID = 'local-user';

export interface TripDetail {
  trip: Trip;
  places: PlaceVisit[];
  transportLegs: TripTransportLeg[];
  quickRecords: ManualTimelineEntry[];
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
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  memo: string;
  castleId: string;
}

export interface TripTransportLegInput {
  date: string;
  fromName: string;
  toName: string;
  transportMode: TripTransportMode;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  durationMinutes: string;
  distanceKm: string;
  oneWayCost: string;
  partyCount: string;
  totalCost: string;
  memo: string;
}

export interface QuickTripTransportLegInput {
  fromName: string;
  toName?: string;
  toPlaceVisitId?: EntityId;
  transportMode: TripTransportMode;
  departureAt?: string;
  memo?: string;
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
  errors.push(...validatePlaceVisitDateTimeInput(input));
  return errors;
}

export function validateTripTransportLegInput(input: TripTransportLegInput): string[] {
  const errors: string[] = [];
  errors.push(...validateTransportLegDateTimeInput(input));
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
    const [places, transportLegs, manualTimelineEntries] = await Promise.all([
      repositories.placeVisits.listByTripId(tripId),
      repositories.tripTransportLegs.listByTripId(tripId),
      repositories.manualTimelineEntries.listByTripId(tripId),
    ]);
    const sortedTransportLegs = sortTransportLegs(transportLegs);
    return {
      trip,
      places: places.slice().sort((a, b) => String(a.arrivalAt || a.visitedAt || '').localeCompare(String(b.arrivalAt || b.visitedAt || ''))),
      transportLegs: sortedTransportLegs,
      quickRecords: manualTimelineEntries
        .filter(isQuickTravelRecord)
        .sort((a, b) => String(b.startAt || b.createdAt).localeCompare(String(a.startAt || a.createdAt))),
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

export async function createQuickTripTransportLeg(
  tripId: EntityId,
  input: QuickTripTransportLegInput,
  now = new Date(),
): Promise<TripTransportLeg> {
  try {
    await bootstrapAppData();
    const trip = await repositories.trips.getById(tripId);
    if (!trip) throw new Error('旅行が見つかりません。');
    const currentLegs = await repositories.tripTransportLegs.listByTripId(tripId);
    if (findInProgressTransportLegs(currentLegs).length > 0) {
      throw new Error('移動中の区間を到着済みにしてから、次の移動を記録してください。');
    }
    if (!input.fromName.trim()) throw new Error('出発地を入力してください。');
    const destinationPlace = input.toPlaceVisitId
      ? await repositories.placeVisits.getById(input.toPlaceVisitId)
      : undefined;
    if (input.toPlaceVisitId && (!destinationPlace || destinationPlace.tripId !== tripId)) {
      throw new Error('到着先の訪問場所を確認してください。');
    }

    const departure = input.departureAt ? new Date(input.departureAt) : now;
    if (Number.isNaN(departure.getTime())) throw new Error('出発日時を正しく入力してください。');
    if (departure.getTime() > now.getTime()) throw new Error('出発日時は現在以前にしてください。');
    const createdAt = now.toISOString();
    const departureFields = buildTransportLegDateTimeFields(createTransportDepartureNowInput(departure));
    return await repositories.tripTransportLegs.save({
      ...departureFields,
      id: createId('transport-leg'),
      userId: LOCAL_USER_ID,
      tripId,
      fromName: input.fromName.trim(),
      toName: destinationPlace?.name ?? optionalText(input.toName ?? ''),
      toPlaceVisitId: destinationPlace?.id,
      transportMode: input.transportMode,
      departureAt: departure.toISOString(),
      partyCount: 1,
      totalCost: 0,
      costSource: 'manual',
      estimatePrecision: 'exact',
      memo: optionalText(input.memo ?? ''),
      sortOrder: currentLegs.length + 1,
      createdAt,
      updatedAt: createdAt,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, error instanceof Error ? error.message : '移動を開始できませんでした。');
  }
}

export async function arriveTripTransportLegNow(
  legId: EntityId,
  toName?: string,
  now = new Date(),
): Promise<TripTransportLeg> {
  try {
    await bootstrapAppData();
    const current = await repositories.tripTransportLegs.getById(legId);
    if (!current) throw new Error('移動区間が見つかりません。');
    if (current.arrivalAt) return current;
    if (!current.departureAt) throw new Error('出発日時がないため、詳細編集から到着時刻を記録してください。');
    if (now.getTime() < new Date(current.departureAt).getTime()) {
      throw new Error('到着日時は出発日時以降にしてください。');
    }
    const arrival = createTransportArrivalNowInput(now);
    const durationMinutes = Math.max(0, Math.round((now.getTime() - new Date(current.departureAt).getTime()) / 60_000));
    return await repositories.tripTransportLegs.save({
      ...current,
      toName: optionalText(toName ?? '') ?? current.toName,
      arrivalTime: arrival.arrivalTime,
      arrivalAt: now.toISOString(),
      durationMinutes: current.durationMinutes ?? durationMinutes,
      updatedAt: now.toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, error instanceof Error ? error.message : '到着時刻を記録できませんでした。');
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
      toPlaceVisitId: input.toName.trim() === current.toName?.trim() ? current.toPlaceVisitId : undefined,
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
      ...buildPlaceVisitDateTimeFields(input),
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

export async function createQuickPlaceVisit(
  tripId: EntityId,
  name: string,
  now = new Date(),
): Promise<PlaceVisit> {
  try {
    await bootstrapAppData();
    const currentPlaces = await repositories.placeVisits.listByTripId(tripId);
    if (findInProgressPlaceVisits(currentPlaces).length > 0) {
      throw new Error('滞在中の場所を出発してから、次の場所を記録してください。');
    }
    return await createPlaceVisit(tripId, {
      name,
      address: '',
      ...createArrivalNowInput(now),
      memo: '',
      castleId: '',
    });
  } catch (error) {
    throw toAppError(error, '現在地の記録に失敗しました');
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
      ...buildPlaceVisitDateTimeFields(input),
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

export async function departPlaceVisitNow(
  placeId: EntityId,
  now = new Date(),
): Promise<PlaceVisit> {
  try {
    await bootstrapAppData();
    const current = await repositories.placeVisits.getById(placeId);
    if (!current) throw new Error('訪問場所が見つかりません。');
    if (current.departureAt) return current;
    if (!current.arrivalAt) throw new Error('到着時刻がないため、詳細編集から出発時刻を記録してください。');

    return await updatePlaceVisit(placeId, {
      name: current.name,
      address: current.address ?? '',
      visitedDate: isoDateTimeToDateInput(current.arrivalAt),
      arrivalTime: isoDateTimeToTimeInput(current.arrivalAt),
      ...createDepartureNowInput(now),
      memo: current.memo ?? '',
      castleId: current.castleId ?? '',
    });
  } catch (error) {
    throw toAppError(error, '出発時刻の記録に失敗しました');
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
  | 'departureAt'
  | 'arrivalAt'
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
    ...buildTransportLegDateTimeFields(input),
    fromName: input.fromName.trim(),
    toName: input.toName.trim(),
    transportMode: input.transportMode,
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
    String(a.departureAt || a.date).localeCompare(String(b.departureAt || b.date))
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
