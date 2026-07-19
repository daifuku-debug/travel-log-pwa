import type { Trip } from '../../domain/models/trip';
import { toDateInputValue } from '../../shared/date/dateUtils';

export type TripDisplayStatus = 'ongoing' | 'upcoming' | 'completed';
export type TripListFilter = 'all' | 'upcoming' | 'completed';

export function getTripDisplayStatus(trip: Pick<Trip, 'startDate' | 'endDate'>, now = new Date()): TripDisplayStatus {
  const today = toDateInputValue(now);
  if (trip.startDate > today) return 'upcoming';
  if (trip.endDate < today) return 'completed';
  return 'ongoing';
}

export function filterTripsForDisplay(trips: Trip[], filter: TripListFilter, now = new Date()): Trip[] {
  if (filter === 'all') return trips;
  return trips.filter((trip) => {
    const status = getTripDisplayStatus(trip, now);
    return filter === 'completed' ? status === 'completed' : status !== 'completed';
  });
}

export function groupTripsForDisplay(trips: Trip[], now = new Date()) {
  return [
    { status: 'ongoing' as const, title: '旅行中', trips: trips.filter((trip) => getTripDisplayStatus(trip, now) === 'ongoing') },
    { status: 'upcoming' as const, title: 'これから', trips: trips.filter((trip) => getTripDisplayStatus(trip, now) === 'upcoming') },
    { status: 'completed' as const, title: 'これまでの旅行', trips: trips.filter((trip) => getTripDisplayStatus(trip, now) === 'completed') },
  ].filter((group) => group.trips.length > 0);
}

export function getTripDisplayStatusLabel(status: TripDisplayStatus): string {
  if (status === 'ongoing') return '旅行中';
  if (status === 'upcoming') return '予定';
  return '完了';
}
