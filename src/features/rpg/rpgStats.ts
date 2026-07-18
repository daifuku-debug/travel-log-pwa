import type { CollectionCategory } from '../../domain/models/collection';
import type { CastleVisitSummary } from '../../domain/models/castle';
import type { PrefectureVisit } from '../../domain/models/japanConquest';
import type { Scrapbook } from '../../domain/models/scrapbook';

export interface TravelStats {
  tripCompletedCount: number;
  dayTripCompletedCount: number;
  overnightTripCompletedCount: number;
  placeVisitCount: number;
  prefectureVisitedCount: number;
  prefectureStayedCount: number;
  prefectureLivedCount: number;
  collectionCompletedCount: number;
  castleVisitedCount: number;
  castleJapanese100VisitedCount: number;
  castleContinued100VisitedCount: number;
  castleStampCount: number;
  castleGoshuinCount: number;
  scrapbookCreatedCount: number;
  scrapbookCompletedCount: number;
  wishlistItemCount: number;
  maxSamePrefectureVisitCount: number;
  collectionCompletedByCategory: Record<string, number>;
}

export function buildTravelStats(input: {
  tripTypes: Array<'dayTrip' | 'overnight'>;
  placeVisitCount: number;
  prefectures: PrefectureVisit[];
  collections: Array<{ category: CollectionCategory; visitedCount: number }>;
  castleSummaries?: CastleVisitSummary[];
  castleSeriesById?: Map<string, 'japanese_100_castles' | 'continued_japanese_100_castles'>;
  scrapbooks?: Scrapbook[];
  wishlistItemCount: number;
}): TravelStats {
  const collectionCompletedByCategory: Record<string, number> = {};
  for (const collection of input.collections) {
    collectionCompletedByCategory[collection.category] =
      (collectionCompletedByCategory[collection.category] ?? 0) + collection.visitedCount;
  }
  const castleSummaries = input.castleSummaries ?? [];
  const visitedCastles = castleSummaries.filter((summary) => summary.status === 'visited');
  const scrapbooks = input.scrapbooks ?? [];

  return {
    tripCompletedCount: input.tripTypes.length,
    dayTripCompletedCount: input.tripTypes.filter((type) => type === 'dayTrip').length,
    overnightTripCompletedCount: input.tripTypes.filter((type) => type === 'overnight').length,
    placeVisitCount: input.placeVisitCount,
    prefectureVisitedCount: input.prefectures.filter((visit) => visit.status === 'visited' || visit.status === 'stayed' || visit.status === 'lived').length,
    prefectureStayedCount: input.prefectures.filter((visit) => visit.status === 'stayed' || visit.status === 'lived').length,
    prefectureLivedCount: input.prefectures.filter((visit) => visit.status === 'lived').length,
    collectionCompletedCount: input.collections.reduce((sum, collection) => sum + collection.visitedCount, 0),
    castleVisitedCount: visitedCastles.length,
    castleJapanese100VisitedCount: visitedCastles.filter((summary) => input.castleSeriesById?.get(summary.castleId) === 'japanese_100_castles').length,
    castleContinued100VisitedCount: visitedCastles.filter((summary) => input.castleSeriesById?.get(summary.castleId) === 'continued_japanese_100_castles').length,
    castleStampCount: castleSummaries.filter((summary) => summary.stampStatus === 'acquired').length,
    castleGoshuinCount: castleSummaries.filter((summary) => summary.goshuinStatus === 'acquired').length,
    scrapbookCreatedCount: scrapbooks.length,
    scrapbookCompletedCount: scrapbooks.filter((scrapbook) => scrapbook.status === 'completed').length,
    wishlistItemCount: input.wishlistItemCount,
    maxSamePrefectureVisitCount: input.prefectures.reduce((max, visit) => Math.max(max, visit.visitCount), 0),
    collectionCompletedByCategory,
  };
}
