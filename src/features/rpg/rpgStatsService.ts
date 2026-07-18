import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { buildTravelStats, type TravelStats } from './rpgStats';

export async function getTravelStats(): Promise<TravelStats> {
  await bootstrapAppData();
  const [trips, places, prefectures, collections, wishlist] = await Promise.all([
    repositories.trips.list(),
    repositories.placeVisits.list(),
    repositories.prefectureVisits.list(),
    repositories.collections.listWithProgress(),
    repositories.wishlist.list(),
  ]);

  return buildTravelStats({
    tripTypes: trips.map((trip) => trip.tripType),
    placeVisitCount: places.length,
    prefectures,
    collections,
    wishlistItemCount: wishlist.length,
  });
}
