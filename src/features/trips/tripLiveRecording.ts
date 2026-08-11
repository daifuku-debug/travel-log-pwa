import type { Trip } from '../../domain/models/trip.ts';
import { isValidDateInputValue } from '../../shared/date/dateUtils.ts';
import { getTripDisplayStatus, type TripDisplayStatus } from './tripUi.ts';

export type TripLiveRecordingState = TripDisplayStatus | 'unknown';

export interface TripLiveRecordingAvailability {
  allowed: boolean;
  state: TripLiveRecordingState;
}

export function resolveTripLiveRecordingAvailability(
  trip: Pick<Trip, 'startDate' | 'endDate'>,
  now = new Date(),
): TripLiveRecordingAvailability {
  if (
    !isValidDateInputValue(trip.startDate)
    || !isValidDateInputValue(trip.endDate)
    || trip.startDate > trip.endDate
  ) {
    return { allowed: false, state: 'unknown' };
  }

  const state = getTripDisplayStatus(trip, now);
  return { allowed: state === 'ongoing', state };
}
