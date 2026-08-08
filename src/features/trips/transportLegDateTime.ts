import type { TripTransportLeg } from '../../domain/models/trip.ts';
import {
  dateTimeInputToIsoDateTime,
  isValidDateInputValue,
  isValidTimeInputValue,
  isoDateTimeToDateInput,
  isoDateTimeToTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from '../../shared/date/dateUtils.ts';

export interface TransportLegDateTimeInput {
  date: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
}

export function createTransportDepartureNowInput(now = new Date()): TransportLegDateTimeInput {
  const date = toDateInputValue(now);
  return {
    date,
    departureTime: toTimeInputValue(now),
    arrivalDate: date,
    arrivalTime: '',
  };
}

export function createTransportArrivalNowInput(now = new Date()): Pick<
  TransportLegDateTimeInput,
  'arrivalDate' | 'arrivalTime'
> {
  return {
    arrivalDate: toDateInputValue(now),
    arrivalTime: toTimeInputValue(now),
  };
}

export function validateTransportLegDateTimeInput(input: TransportLegDateTimeInput): string[] {
  const errors: string[] = [];
  if (!isValidDateInputValue(input.date)) errors.push('出発日を正しく入力してください。');
  if (input.departureTime && !isValidTimeInputValue(input.departureTime)) {
    errors.push('出発時刻を正しく入力してください。');
  }
  if (input.arrivalDate && !isValidDateInputValue(input.arrivalDate)) {
    errors.push('到着日を正しく入力してください。');
  }
  if (input.arrivalTime && !isValidTimeInputValue(input.arrivalTime)) {
    errors.push('到着時刻を正しく入力してください。');
  }
  const effectiveArrivalDate = input.arrivalDate || input.date;
  if (input.arrivalTime && !effectiveArrivalDate) {
    errors.push('到着時刻を記録するには到着日を入力してください。');
  }
  if (input.arrivalTime && input.date && effectiveArrivalDate < input.date) {
    errors.push('到着日は出発日以降にしてください。');
  }
  const departureAt = dateTimeInputToIsoDateTime(input.date, input.departureTime);
  const arrivalAt = dateTimeInputToIsoDateTime(effectiveArrivalDate, input.arrivalTime);
  if (departureAt && arrivalAt && arrivalAt < departureAt) {
    errors.push('到着日時は出発日時以降にしてください。日付をまたぐ場合は到着日を翌日に変更してください。');
  }
  return errors;
}

export function buildTransportLegDateTimeFields(
  input: TransportLegDateTimeInput,
): Pick<TripTransportLeg, 'date' | 'departureTime' | 'arrivalTime' | 'departureAt' | 'arrivalAt'> {
  return {
    date: input.date,
    departureTime: input.departureTime || undefined,
    arrivalTime: input.arrivalTime || undefined,
    departureAt: dateTimeInputToIsoDateTime(input.date, input.departureTime),
    arrivalAt: dateTimeInputToIsoDateTime(input.arrivalDate || input.date, input.arrivalTime),
  };
}

export function getTransportLegDepartureDate(
  leg: Pick<TripTransportLeg, 'date' | 'departureAt'>,
): string {
  return isoDateTimeToDateInput(leg.departureAt) || leg.date;
}

export function getTransportLegArrivalDate(
  leg: Pick<TripTransportLeg, 'date' | 'arrivalAt'>,
): string {
  return isoDateTimeToDateInput(leg.arrivalAt) || leg.date;
}

export function getTransportLegDepartureTime(
  leg: Pick<TripTransportLeg, 'departureAt' | 'departureTime'>,
): string {
  return isoDateTimeToTimeInput(leg.departureAt) || leg.departureTime || '';
}

export function getTransportLegArrivalTime(
  leg: Pick<TripTransportLeg, 'arrivalAt' | 'arrivalTime'>,
): string {
  return isoDateTimeToTimeInput(leg.arrivalAt) || leg.arrivalTime || '';
}

export function isTransportLegInProgress(
  leg: Pick<TripTransportLeg, 'departureAt' | 'arrivalAt'>,
): boolean {
  return Boolean(leg.departureAt && !leg.arrivalAt);
}

export function findInProgressTransportLegs<
  T extends Pick<TripTransportLeg, 'departureAt' | 'arrivalAt'>,
>(legs: T[]): T[] {
  return legs.filter(isTransportLegInProgress);
}

export function formatTransportLegTimeRange(
  leg: Pick<TripTransportLeg, 'date' | 'departureAt' | 'arrivalAt' | 'departureTime' | 'arrivalTime'>,
): string {
  const departureTime = getTransportLegDepartureTime(leg);
  const arrivalTime = getTransportLegArrivalTime(leg);
  if (!departureTime && !arrivalTime) return '時刻未設定';
  if (departureTime && !arrivalTime) {
    return isTransportLegInProgress(leg) ? `${departureTime} 出発・移動中` : `${departureTime} 出発`;
  }
  if (!departureTime) return `${arrivalTime} 到着`;

  const departureDate = getTransportLegDepartureDate(leg);
  const arrivalDate = getTransportLegArrivalDate(leg);
  if (arrivalDate === departureDate) return `${departureTime}–${arrivalTime}`;
  return `${departureTime}–${formatShortDate(arrivalDate)} ${arrivalTime}`;
}

export function formatTransportLegTitle(
  leg: Pick<TripTransportLeg, 'fromName' | 'toName'>,
): string {
  return `${leg.fromName} → ${leg.toName?.trim() || '目的地未定'}`;
}

function formatShortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
}
