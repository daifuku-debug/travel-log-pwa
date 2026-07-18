import castleMasterData from '../../domain/castles/castleMaster.json';
import type { EntityId } from '../../domain/models/common';
import type { CastleMaster, CastleVisitEvent, CastleVisitSummary } from '../../domain/models/castle';
import type {
  CastleMasterRepository,
  CastleVisitEventRepository,
  CastleVisitSummaryRepository,
} from '../../domain/repositories/CastleRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

interface CastleMasterJson {
  castles: CastleMaster[];
}

export class StaticCastleMasterRepository implements CastleMasterRepository {
  private readonly castles = (castleMasterData as CastleMasterJson).castles;

  async list(): Promise<CastleMaster[]> {
    return this.castles.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getById(id: EntityId): Promise<CastleMaster | undefined> {
    return this.castles.find((castle) => castle.id === id);
  }
}

export class LocalCastleVisitSummaryRepository
  extends LocalBaseRepository<CastleVisitSummary>
  implements CastleVisitSummaryRepository
{
  constructor() {
    super('castleVisitSummaries');
  }

  async getByCastleId(castleId: EntityId): Promise<CastleVisitSummary | undefined> {
    return this.getById(castleId);
  }
}

export class LocalCastleVisitEventRepository
  extends LocalBaseRepository<CastleVisitEvent>
  implements CastleVisitEventRepository
{
  constructor() {
    super('castleVisitEvents');
  }

  async listByCastleId(castleId: EntityId): Promise<CastleVisitEvent[]> {
    const events = await this.list();
    return events
      .filter((event) => event.castleId === castleId)
      .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
  }

  async getBySourceKey(sourceKey: string): Promise<CastleVisitEvent | undefined> {
    const events = await this.list();
    return events.find((event) => event.sourceKey === sourceKey);
  }
}
