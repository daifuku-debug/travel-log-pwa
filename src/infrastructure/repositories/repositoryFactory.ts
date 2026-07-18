import {
  LocalCastleVisitEventRepository,
  LocalCastleVisitSummaryRepository,
  StaticCastleMasterRepository,
} from '../localDb/LocalCastleRepository';
import { LocalCollectionRepository, LocalCollectionItemRepository, LocalCollectionVisitRepository } from '../localDb/LocalCollectionRepository';
import {
  LocalPrefectureVisitRepository,
  LocalTripPrefectureVisitRepository,
  StaticPrefectureMasterRepository,
} from '../localDb/LocalPrefectureRepository';
import {
  LocalRpgExperienceRepository,
  LocalRpgQuestRepository,
  LocalRpgSettingsRepository,
  LocalTripRpgResultRepository,
  LocalUserRpgAchievementRepository,
  LocalUserRpgTitleRepository,
  StaticRpgAchievementMasterRepository,
  StaticRpgTitleMasterRepository,
} from '../localDb/LocalRpgRepository';
import { LocalPlaceVisitRepository, LocalTripRepository } from '../localDb/LocalTripRepository';
import { LocalWishlistRepository } from '../localDb/LocalWishlistRepository';

const collectionItemRepository = new LocalCollectionItemRepository();
const collectionVisitRepository = new LocalCollectionVisitRepository();

export const repositories = {
  trips: new LocalTripRepository(),
  placeVisits: new LocalPlaceVisitRepository(),
  wishlist: new LocalWishlistRepository(),
  collections: new LocalCollectionRepository(collectionItemRepository, collectionVisitRepository),
  collectionItems: collectionItemRepository,
  collectionVisits: collectionVisitRepository,
  prefectureMaster: new StaticPrefectureMasterRepository(),
  prefectureVisits: new LocalPrefectureVisitRepository(),
  tripPrefectureVisits: new LocalTripPrefectureVisitRepository(),
  castleMaster: new StaticCastleMasterRepository(),
  castleVisitSummaries: new LocalCastleVisitSummaryRepository(),
  castleVisitEvents: new LocalCastleVisitEventRepository(),
  rpgExperienceEntries: new LocalRpgExperienceRepository(),
  rpgTitleMaster: new StaticRpgTitleMasterRepository(),
  userRpgTitles: new LocalUserRpgTitleRepository(),
  rpgAchievementMaster: new StaticRpgAchievementMasterRepository(),
  userRpgAchievements: new LocalUserRpgAchievementRepository(),
  rpgQuests: new LocalRpgQuestRepository(),
  tripRpgResults: new LocalTripRpgResultRepository(),
  rpgSettings: new LocalRpgSettingsRepository(),
};
