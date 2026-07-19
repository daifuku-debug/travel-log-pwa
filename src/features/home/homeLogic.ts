import type { Trip } from '../../domain/models/trip';
import { getTripDisplayStatus, type TripDisplayStatus } from '../trips/tripUi';

export interface FeaturedTrip {
  trip: Trip;
  status: TripDisplayStatus;
}

export function selectFeaturedTrip(trips: Trip[], now = new Date()): FeaturedTrip | undefined {
  const withStatus = trips.map((trip) => ({ trip, status: getTripDisplayStatus(trip, now) }));
  const ongoing = withStatus
    .filter(({ status }) => status === 'ongoing')
    .sort((a, b) => a.trip.endDate.localeCompare(b.trip.endDate))[0];
  if (ongoing) return ongoing;
  const upcoming = withStatus
    .filter(({ status }) => status === 'upcoming')
    .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate))[0];
  if (upcoming) return upcoming;
  return withStatus
    .filter(({ status }) => status === 'completed')
    .sort((a, b) => b.trip.endDate.localeCompare(a.trip.endDate))[0];
}
