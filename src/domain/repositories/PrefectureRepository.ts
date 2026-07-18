import type { EntityId } from '../models/common';
import type { PrefectureMaster, PrefectureVisit, TripPrefectureVisit } from '../models/japanConquest';
import type { BaseRepository } from './BaseRepository';

export interface PrefectureMasterRepository {
  list(): Promise<PrefectureMaster[]>;
  getByCode(code: string): Promise<PrefectureMaster | undefined>;
}

export interface PrefectureVisitRepository extends BaseRepository<PrefectureVisit> {
  getByPrefectureCode(code: string): Promise<PrefectureVisit | undefined>;
}

export interface TripPrefectureVisitRepository extends BaseRepository<TripPrefectureVisit> {
  listByTripId(tripId: EntityId): Promise<TripPrefectureVisit[]>;
  listByPrefectureCode(prefectureCode: string): Promise<TripPrefectureVisit[]>;
}
