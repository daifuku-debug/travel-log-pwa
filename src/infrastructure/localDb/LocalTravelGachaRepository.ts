import type { TravelGachaDraw } from '../../domain/models/travelGacha';
import type { TravelGachaDrawRepository } from '../../domain/repositories/TravelGachaRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalTravelGachaDrawRepository
  extends LocalBaseRepository<TravelGachaDraw>
  implements TravelGachaDrawRepository
{
  constructor() {
    super('travelGachaDraws');
  }

  async listRecent(limit: number): Promise<TravelGachaDraw[]> {
    const draws = await this.list();
    return draws
      .slice()
      .sort((a, b) => b.drawnAt.localeCompare(a.drawnAt))
      .slice(0, limit);
  }
}
