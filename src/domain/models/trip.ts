import type { BaseEntity, EntityId, IsoDateString, IsoDateTimeString } from './common';

export type TripType = 'dayTrip' | 'overnight';

export interface Trip extends BaseEntity {
  title: string;
  startDate: IsoDateString;
  endDate: IsoDateString;
  tripType: TripType;
  companions: string[];
  purpose?: string;
  memo?: string;
}

export interface PlaceVisit extends BaseEntity {
  tripId: EntityId;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  visitedAt?: IsoDateTimeString;
  memo?: string;
  castleId?: EntityId;
  collectionItemIds: EntityId[];
}
