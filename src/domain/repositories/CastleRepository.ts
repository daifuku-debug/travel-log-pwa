import type { EntityId } from '../models/common';
import type { CastleMaster, CastleVisitEvent, CastleVisitSummary } from '../models/castle';
import type { BaseRepository } from './BaseRepository';

export interface CastleMasterRepository {
  list(): Promise<CastleMaster[]>;
  getById(id: EntityId): Promise<CastleMaster | undefined>;
}

export interface CastleVisitSummaryRepository extends BaseRepository<CastleVisitSummary> {
  getByCastleId(castleId: EntityId): Promise<CastleVisitSummary | undefined>;
}

export interface CastleVisitEventRepository extends BaseRepository<CastleVisitEvent> {
  listByCastleId(castleId: EntityId): Promise<CastleVisitEvent[]>;
  getBySourceKey(sourceKey: string): Promise<CastleVisitEvent | undefined>;
}
