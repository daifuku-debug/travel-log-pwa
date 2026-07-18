import prefectureMasterData from '../../domain/prefectures/prefectureMaster.json';
import type { EntityId } from '../../domain/models/common';
import type { PrefectureMaster, PrefectureVisit, TripPrefectureVisit } from '../../domain/models/japanConquest';
import type {
  PrefectureMasterRepository,
  PrefectureVisitRepository,
  TripPrefectureVisitRepository,
} from '../../domain/repositories/PrefectureRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class StaticPrefectureMasterRepository implements PrefectureMasterRepository {
  private readonly prefectures = prefectureMasterData as PrefectureMaster[];

  async list(): Promise<PrefectureMaster[]> {
    return this.prefectures;
  }

  async getByCode(code: string): Promise<PrefectureMaster | undefined> {
    return this.prefectures.find((prefecture) => prefecture.code === code);
  }
}

export class LocalPrefectureVisitRepository
  extends LocalBaseRepository<PrefectureVisit>
  implements PrefectureVisitRepository
{
  constructor() {
    super('prefectureVisits');
  }

  async getByPrefectureCode(code: string): Promise<PrefectureVisit | undefined> {
    return this.getById(code);
  }
}

export class LocalTripPrefectureVisitRepository
  extends LocalBaseRepository<TripPrefectureVisit>
  implements TripPrefectureVisitRepository
{
  constructor() {
    super('tripPrefectureVisits');
  }

  async listByTripId(tripId: EntityId): Promise<TripPrefectureVisit[]> {
    const rows = await this.list();
    return rows.filter((row) => row.tripId === tripId);
  }

  async listByPrefectureCode(prefectureCode: string): Promise<TripPrefectureVisit[]> {
    const rows = await this.list();
    return rows.filter((row) => row.prefectureCode === prefectureCode);
  }
}
