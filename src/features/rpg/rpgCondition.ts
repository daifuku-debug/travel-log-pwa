import type { RpgConditionType } from '../../domain/models/rpg';
import type { TravelStats } from './rpgStats';

export function getConditionValue(
  stats: TravelStats,
  conditionType: RpgConditionType,
  conditionCategory?: string,
): number {
  switch (conditionType) {
    case 'tripCompletedCount':
      return stats.tripCompletedCount;
    case 'dayTripCompletedCount':
      return stats.dayTripCompletedCount;
    case 'overnightTripCompletedCount':
      return stats.overnightTripCompletedCount;
    case 'placeVisitCount':
      return stats.placeVisitCount;
    case 'prefectureVisitedCount':
      return stats.prefectureVisitedCount;
    case 'prefectureStayedCount':
      return stats.prefectureStayedCount;
    case 'prefectureLivedCount':
      return stats.prefectureLivedCount;
    case 'collectionCompletedCount':
      return stats.collectionCompletedCount;
    case 'collectionCategoryCompletedCount':
      return conditionCategory ? stats.collectionCompletedByCategory[conditionCategory] ?? 0 : 0;
    case 'castleVisitedCount':
      return stats.castleVisitedCount;
    case 'castleJapanese100VisitedCount':
      return stats.castleJapanese100VisitedCount;
    case 'castleContinued100VisitedCount':
      return stats.castleContinued100VisitedCount;
    case 'castleStampCount':
      return stats.castleStampCount;
    case 'castleGoshuinCount':
      return stats.castleGoshuinCount;
    case 'samePrefectureVisitCount':
      return stats.maxSamePrefectureVisitCount;
    case 'wishlistItemCount':
      return stats.wishlistItemCount;
    case 'manual':
      return 0;
    default:
      return 0;
  }
}
