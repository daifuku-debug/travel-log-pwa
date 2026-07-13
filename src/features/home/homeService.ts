import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { listRecentTrips } from '../trips/tripService';

export interface HomeSummary {
  recentTrips: Awaited<ReturnType<typeof listRecentTrips>>;
  tripCount: number;
  placeVisitCount: number;
  collectionAchievementRate: number;
}

export async function getHomeSummary(): Promise<HomeSummary> {
  try {
    await bootstrapAppData();
    const [recentTrips, trips, places, collections] = await Promise.all([
      listRecentTrips(3),
      repositories.trips.list(),
      repositories.placeVisits.list(),
      repositories.collections.listWithProgress(),
    ]);
    const totalItems = collections.reduce((sum, collection) => sum + collection.totalCount, 0);
    const visitedItems = collections.reduce((sum, collection) => sum + collection.visitedCount, 0);

    return {
      recentTrips,
      tripCount: trips.length,
      placeVisitCount: places.length,
      collectionAchievementRate: totalItems === 0 ? 0 : Math.round((visitedItems / totalItems) * 100),
    };
  } catch (error) {
    throw toAppError(error, 'ホーム情報の読み込みに失敗しました');
  }
}
