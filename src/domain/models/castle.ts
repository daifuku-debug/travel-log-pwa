import type { BaseEntity, EntityId, IsoDateString } from './common';

export type CastleSeries = 'japanese_100_castles' | 'continued_japanese_100_castles';
export type CastleVisitStatus = 'unvisited' | 'planned' | 'visited';
export type CastleAcquisitionStatus = 'unknown' | 'not_acquired' | 'acquired';
export type CastleVisitEventSource = 'manual' | 'trip' | 'import' | 'migration';

export interface CastleMaster {
  id: EntityId;
  officialNumber: number;
  sourceNumber: number;
  nameJa: string;
  nameKana?: string;
  nameEn?: string;
  series: CastleSeries;
  prefectureCode: string;
  prefectureName: string;
  municipality: string;
  region: string;
  latitude?: number | null;
  longitude?: number | null;
  locationNote?: string;
  officialReferenceUrl?: string;
  managingOrganizationUrl?: string;
  verificationStatus: 'official_list_verified_coordinates_unverified' | 'verified';
  dataSource: string;
  sourceCheckedAt: IsoDateString;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CastleVisitSummary extends BaseEntity {
  castleId: EntityId;
  status: CastleVisitStatus;
  firstVisitedAt?: IsoDateString;
  lastVisitedAt?: IsoDateString;
  visitCount: number;
  stampStatus: CastleAcquisitionStatus;
  stampAcquiredAt?: IsoDateString;
  goshuinStatus: CastleAcquisitionStatus;
  goshuinAcquiredAt?: IsoDateString;
  rating?: number;
  isFavorite: boolean;
  note?: string;
  relatedTripIds: EntityId[];
}

export interface CastleVisitEvent extends BaseEntity {
  castleId: EntityId;
  visitedAt: IsoDateString;
  tripId?: EntityId;
  locationId?: EntityId;
  stampAcquired: boolean;
  goshuinAcquired: boolean;
  note?: string;
  source: CastleVisitEventSource;
  sourceKey: string;
}
