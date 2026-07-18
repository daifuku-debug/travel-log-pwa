import type { EntityId } from '../../domain/models/common';
import type { PlaceVisit, Trip, TripTransportLeg } from '../../domain/models/trip';
import type { PlaceVisitRepository, TripRepository, TripTransportLegRepository } from '../../domain/repositories/TripRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalTripRepository extends LocalBaseRepository<Trip> implements TripRepository {
  constructor() {
    super('trips');
  }

  async listRecent(limit: number): Promise<Trip[]> {
    const trips = await this.list();
    return trips
      .slice()
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, limit);
  }
}

export class LocalPlaceVisitRepository
  extends LocalBaseRepository<PlaceVisit>
  implements PlaceVisitRepository
{
  constructor() {
    super('placeVisits');
  }

  async listByTripId(tripId: EntityId): Promise<PlaceVisit[]> {
    const visits = await this.list();
    return visits.filter((visit) => visit.tripId === tripId);
  }
}

export class LocalTripTransportLegRepository
  extends LocalBaseRepository<TripTransportLeg>
  implements TripTransportLegRepository
{
  constructor() {
    super('tripTransportLegs');
  }

  async listByTripId(tripId: EntityId): Promise<TripTransportLeg[]> {
    const legs = await this.list();
    return legs.filter((leg) => leg.tripId === tripId);
  }
}
