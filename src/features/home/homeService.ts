import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { getRpgProfile } from '../rpg/rpgProfileService';
import { listRecentTrips } from '../trips/tripService';
import { selectFeaturedTrip, type FeaturedTrip } from './homeLogic';

export interface HomeSummary {
  recentTrips: Awaited<ReturnType<typeof listRecentTrips>>;
  tripCount: number;
  placeVisitCount: number;
  collectionAchievementRate: number;
  featuredTrip?: FeaturedTrip;
  rpg: {
    level: number;
    mainTitleName: string;
    expToNextLevel: number;
    questTitles: string[];
    recentAchievementNames: string[];
  };
}

export async function getHomeSummary(): Promise<HomeSummary> {
  try {
    await bootstrapAppData();
    const [recentTrips, trips, places, collections, rpgProfile] = await Promise.all([
      listRecentTrips(3),
      repositories.trips.list(),
      repositories.placeVisits.list(),
      repositories.collections.listWithProgress(),
      getRpgProfile(),
    ]);
    const totalItems = collections.reduce((sum, collection) => sum + collection.totalCount, 0);
    const visitedItems = collections.reduce((sum, collection) => sum + collection.visitedCount, 0);

    return {
      recentTrips,
      tripCount: trips.length,
      placeVisitCount: places.length,
      collectionAchievementRate: totalItems === 0 ? 0 : Math.round((visitedItems / totalItems) * 100),
      featuredTrip: selectFeaturedTrip(trips),
      rpg: {
        level: rpgProfile.level.currentLevel,
        mainTitleName: rpgProfile.mainTitleName,
        expToNextLevel: rpgProfile.level.expToNextLevel,
        questTitles: rpgProfile.inProgressQuests.slice(0, 3).map((quest) => quest.title),
        recentAchievementNames: rpgProfile.recentAchievements.slice(0, 3).map((view) => view.displayName),
      },
    };
  } catch (error) {
    throw toAppError(error, 'ホーム情報の読み込みに失敗しました');
  }
}
