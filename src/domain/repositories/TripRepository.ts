import type { EntityId } from '../models/common';
import type { PlaceVisit, Trip, TripTransportLeg } from '../models/trip';
import type { BaseRepository } from './BaseRepository';

export interface TripRepository extends BaseRepository<Trip> {
  listRecent(limit: number): Promise<Trip[]>;
}

export interface PlaceVisitRepository extends BaseRepository<PlaceVisit> {
  listByTripId(tripId: EntityId): Promise<PlaceVisit[]>;
}

export interface TripTransportLegRepository extends BaseRepository<TripTransportLeg> {
  listByTripId(tripId: EntityId): Promise<TripTransportLeg[]>;
}
