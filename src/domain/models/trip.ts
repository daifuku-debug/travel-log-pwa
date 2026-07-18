import type { BaseEntity, EntityId, IsoDateString, IsoDateTimeString } from './common';

export type TripType = 'dayTrip' | 'overnight';
export type TripTransportMode =
  | 'walk'
  | 'bike'
  | 'train'
  | 'shinkansen'
  | 'bus'
  | 'car'
  | 'flight'
  | 'ship'
  | 'taxi'
  | 'other';
export type TransportCostSource = 'manual' | 'estimated' | 'api';
export type TransportEstimatePrecision = 'exact' | 'high' | 'medium' | 'rough' | 'unknown';

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

export interface TripTransportLeg extends BaseEntity {
  tripId: EntityId;
  date: IsoDateString;
  fromName: string;
  toName: string;
  transportMode: TripTransportMode;
  departureTime?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  distanceKm?: number;
  oneWayCost?: number;
  partyCount: number;
  totalCost: number;
  costSource: TransportCostSource;
  estimatePrecision: TransportEstimatePrecision;
  externalProvider?: string;
  externalRouteId?: string;
  memo?: string;
  sortOrder: number;
}
