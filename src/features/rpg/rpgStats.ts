import type { CollectionCategory } from '../../domain/models/collection';
import type { PrefectureVisit } from '../../domain/models/japanConquest';

export interface TravelStats {
  tripCompletedCount: number;
  dayTripCompletedCount: number;
  overnightTripCompletedCount: number;
  placeVisitCount: number;
  prefectureVisitedCount: number;
  prefectureStayedCount: number;
  collectionCompletedCount: number;
  wishlistItemCount: number;
  maxSamePrefectureVisitCount: number;
  collectionCompletedByCategory: Record<string, number>;
}

export function buildTravelStats(input: {
  tripTypes: Array<'dayTrip' | 'overnight'>;
  placeVisitCount: number;
  prefectures: PrefectureVisit[];
  collections: Array<{ category: CollectionCategory; visitedCount: number }>;
  wishlistItemCount: number;
}): TravelStats {
  const collectionCompletedByCategory: Record<string, number> = {};
  for (const collection of input.collections) {
    collectionCompletedByCategory[collection.category] =
      (collectionCompletedByCategory[collection.category] ?? 0) + collection.visitedCount;
  }

  return {
    tripCompletedCount: input.tripTypes.length,
    dayTripCompletedCount: input.tripTypes.filter((type) => type === 'dayTrip').length,
    overnightTripCompletedCount: input.tripTypes.filter((type) => type === 'overnight').length,
    placeVisitCount: input.placeVisitCount,
    prefectureVisitedCount: input.prefectures.filter((visit) => visit.status === 'visited' || visit.status === 'stayed').length,
    prefectureStayedCount: input.prefectures.filter((visit) => visit.status === 'stayed').length,
    collectionCompletedCount: input.collections.reduce((sum, collection) => sum + collection.visitedCount, 0),
    wishlistItemCount: input.wishlistItemCount,
    maxSamePrefectureVisitCount: input.prefectures.reduce((max, visit) => Math.max(max, visit.visitCount), 0),
    collectionCompletedByCategory,
  };
}
