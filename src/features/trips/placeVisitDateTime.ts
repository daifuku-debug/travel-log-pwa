import type { PlaceVisit } from '../../domain/models/trip.ts';
import {
  dateInputToIsoDateTime,
  dateTimeInputToIsoDateTime,
  isValidDateInputValue,
  isValidTimeInputValue,
  isoDateTimeToDateInput,
  isoDateTimeToTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from '../../shared/date/dateUtils.ts';

export interface PlaceVisitDateTimeInput {
  visitedDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
}

export function createArrivalNowInput(now = new Date()): PlaceVisitDateTimeInput {
  const visitedDate = toDateInputValue(now);
  return {
    visitedDate,
    arrivalTime: toTimeInputValue(now),
    departureDate: visitedDate,
    departureTime: '',
  };
}

export function createDepartureNowInput(now = new Date()): Pick<
  PlaceVisitDateTimeInput,
  'departureDate' | 'departureTime'
> {
  return {
    departureDate: toDateInputValue(now),
    departureTime: toTimeInputValue(now),
  };
}

export function isPlaceVisitInProgress(
  place: Pick<PlaceVisit, 'arrivalAt' | 'departureAt'>,
): boolean {
  return Boolean(place.arrivalAt && !place.departureAt);
}

export function findInProgressPlaceVisits<T extends Pick<PlaceVisit, 'arrivalAt' | 'departureAt'>>(
  places: T[],
): T[] {
  return places.filter(isPlaceVisitInProgress);
}

export function validatePlaceVisitDateTimeInput(input: PlaceVisitDateTimeInput): string[] {
  const errors: string[] = [];
  if (input.visitedDate && !isValidDateInputValue(input.visitedDate)) {
    errors.push('訪問日を正しく入力してください。');
  }
  if (input.arrivalTime && !isValidTimeInputValue(input.arrivalTime)) {
    errors.push('到着時刻を正しく入力してください。');
  }
  if (input.arrivalTime && !input.visitedDate) {
    errors.push('到着時刻を記録するには訪問日を入力してください。');
  }
  if (input.departureDate && !isValidDateInputValue(input.departureDate)) {
    errors.push('出発日を正しく入力してください。');
  }
  if (input.departureTime && !isValidTimeInputValue(input.departureTime)) {
    errors.push('出発時刻を正しく入力してください。');
  }
  const effectiveDepartureDate = input.departureDate || input.visitedDate;
  if (input.departureTime && !effectiveDepartureDate) {
    errors.push('出発時刻を記録するには訪問日または出発日を入力してください。');
  }
  if (input.departureTime && input.visitedDate && effectiveDepartureDate < input.visitedDate) {
    errors.push('出発日は訪問日以降にしてください。');
  }
  const arrivalAt = dateTimeInputToIsoDateTime(input.visitedDate, input.arrivalTime);
  const departureAt = dateTimeInputToIsoDateTime(effectiveDepartureDate, input.departureTime);
  if (arrivalAt && departureAt && departureAt < arrivalAt) {
    errors.push('出発日時は到着日時以降にしてください。日付をまたぐ場合は出発日を翌日に変更してください。');
  }
  return errors;
}

export function buildPlaceVisitDateTimeFields(
  input: PlaceVisitDateTimeInput,
): Pick<PlaceVisit, 'visitedAt' | 'arrivalAt' | 'departureAt'> {
  const arrivalAt = dateTimeInputToIsoDateTime(input.visitedDate, input.arrivalTime);
  const departureAt = dateTimeInputToIsoDateTime(input.departureDate || input.visitedDate, input.departureTime);
  return {
    visitedAt: arrivalAt ?? dateInputToIsoDateTime(input.visitedDate),
    arrivalAt,
    departureAt,
  };
}

export function getPlaceVisitDate(place: Pick<PlaceVisit, 'visitedAt' | 'arrivalAt' | 'departureAt'>): string {
  return isoDateTimeToDateInput(place.arrivalAt ?? place.visitedAt ?? place.departureAt);
}

export function formatPlaceVisitTimeRange(
  place: Pick<PlaceVisit, 'visitedAt' | 'arrivalAt' | 'departureAt'>,
): string {
  const arrivalTime = isoDateTimeToTimeInput(place.arrivalAt);
  const departureTime = isoDateTimeToTimeInput(place.departureAt);
  if (!arrivalTime && !departureTime) return '時刻未設定';
  if (arrivalTime && !departureTime) return `${arrivalTime} 到着`;

  const visitDate = getPlaceVisitDate(place);
  const departureDate = isoDateTimeToDateInput(place.departureAt);
  if (!arrivalTime) {
    const datePrefix = departureDate && departureDate !== visitDate ? `${formatShortDate(departureDate)} ` : '';
    return `${datePrefix}${departureTime} 出発`;
  }
  if (!departureDate || departureDate === visitDate) return `${arrivalTime}–${departureTime}`;
  return `${arrivalTime}–${formatShortDate(departureDate)} ${departureTime}`;
}

export function formatPlaceVisitRecordMeta(place: PlaceVisit): string {
  const date = getPlaceVisitDate(place) || '訪問日未設定';
  const time = formatPlaceVisitTimeRange(place);
  return [date, time, place.address].filter(Boolean).join(' / ');
}

function formatShortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
}
