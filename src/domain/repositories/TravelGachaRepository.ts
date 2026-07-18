import type { TravelGachaDraw } from '../models/travelGacha';
import type { BaseRepository } from './BaseRepository';

export interface TravelGachaDrawRepository extends BaseRepository<TravelGachaDraw> {
  listRecent(limit: number): Promise<TravelGachaDraw[]>;
}
