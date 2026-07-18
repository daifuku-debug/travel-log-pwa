import type { BaseEntity, EntityId, IsoDateString, IsoDateTimeString } from './common';

export type JapanRegion =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushuOkinawa';

export type PrefectureVisitStatus = 'unvisited' | 'passed' | 'landed' | 'visited' | 'stayed' | 'lived';

export interface PrefectureMaster {
  code: string;
  nameJa: string;
  nameEn: string;
  region: JapanRegion;
  capital: string;
  geoFeatureId: string;
}

export interface PrefectureVisit extends BaseEntity {
  prefectureCode: string;
  status: PrefectureVisitStatus;
  manualStatus?: PrefectureVisitStatus;
  calculatedStatus?: PrefectureVisitStatus;
  firstVisitedAt?: IsoDateString;
  lastVisitedAt?: IsoDateString;
  visitCount: number;
  note?: string;
  isFavorite: boolean;
}

export interface TripPrefectureVisit extends BaseEntity {
  tripId: EntityId;
  prefectureCode: string;
  visitType: Exclude<PrefectureVisitStatus, 'unvisited'>;
  visitedAt?: IsoDateTimeString;
}
