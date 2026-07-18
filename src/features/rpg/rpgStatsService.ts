import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import {
  SAMPLE_COLLECTION_VISIT_IDS,
  SAMPLE_PLACE_VISIT_IDS,
  SAMPLE_TRIP_IDS,
  SAMPLE_WISHLIST_ITEM_IDS,
} from '../../infrastructure/localDb/sampleData';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { buildTravelStats, type TravelStats } from './rpgStats';

export async function getTravelStats(): Promise<TravelStats> {
  await bootstrapAppData();
  const [trips, places, prefectures, collections, wishlist, castleSummaries, castleMaster, scrapbooks] = await Promise.all([
    repositories.trips.list(),
    repositories.placeVisits.list(),
    repositories.prefectureVisits.list(),
    repositories.collections.listWithProgress(),
    repositories.wishlist.list(),
    repositories.castleVisitSummaries.list(),
    repositories.castleMaster.list(),
    repositories.scrapbooks.list(),
  ]);
  const collectionVisitCountByCollectionId = new Map<string, number>();
  const collectionItems = await repositories.collectionItems.list();
  const collectionVisits = (await repositories.collectionVisits.list())
    .filter((visit) => !SAMPLE_COLLECTION_VISIT_IDS.includes(visit.id));

  for (const visit of collectionVisits) {
    const item = collectionItems.find((row) => row.id === visit.collectionItemId);
    if (!item) continue;
    collectionVisitCountByCollectionId.set(
      item.collectionId,
      (collectionVisitCountByCollectionId.get(item.collectionId) ?? 0) + 1,
    );
  }

  return buildTravelStats({
    tripTypes: trips.filter((trip) => !SAMPLE_TRIP_IDS.includes(trip.id)).map((trip) => trip.tripType),
    placeVisitCount: places.filter((place) => !SAMPLE_PLACE_VISIT_IDS.includes(place.id)).length,
    prefectures,
    collections: collections.map((collection) => ({
      ...collection,
      visitedCount: collectionVisitCountByCollectionId.get(collection.id) ?? 0,
    })),
    castleSummaries,
    castleSeriesById: new Map(castleMaster.map((castle) => [castle.id, castle.series])),
    scrapbooks,
    wishlistItemCount: wishlist.filter((item) => !SAMPLE_WISHLIST_ITEM_IDS.includes(item.id)).length,
  });
}
