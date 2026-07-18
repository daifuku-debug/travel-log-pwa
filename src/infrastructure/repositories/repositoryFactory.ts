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
import { LocalPlaceVisitRepository, LocalTripRepository, LocalTripTransportLegRepository } from '../localDb/LocalTripRepository';
import { LocalManualTimelineEntryRepository } from '../localDb/LocalTimeMachineRepository';
import { LocalTravelGachaDrawRepository } from '../localDb/LocalTravelGachaRepository';
import {
  LocalMediaAssetBlobRepository,
  LocalMediaAssetRepository,
  LocalScrapbookBlockRepository,
  LocalScrapbookPageRepository,
  LocalScrapbookRepository,
} from '../localDb/LocalScrapbookRepository';
import { LocalWishlistRepository } from '../localDb/LocalWishlistRepository';

const collectionItemRepository = new LocalCollectionItemRepository();
const collectionVisitRepository = new LocalCollectionVisitRepository();

export const repositories = {
  trips: new LocalTripRepository(),
  placeVisits: new LocalPlaceVisitRepository(),
  tripTransportLegs: new LocalTripTransportLegRepository(),
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
  scrapbooks: new LocalScrapbookRepository(),
  scrapbookPages: new LocalScrapbookPageRepository(),
  scrapbookBlocks: new LocalScrapbookBlockRepository(),
  mediaAssets: new LocalMediaAssetRepository(),
  mediaAssetBlobs: new LocalMediaAssetBlobRepository(),
  manualTimelineEntries: new LocalManualTimelineEntryRepository(),
  travelGachaDraws: new LocalTravelGachaDrawRepository(),
  rpgExperienceEntries: new LocalRpgExperienceRepository(),
  rpgTitleMaster: new StaticRpgTitleMasterRepository(),
  userRpgTitles: new LocalUserRpgTitleRepository(),
  rpgAchievementMaster: new StaticRpgAchievementMasterRepository(),
  userRpgAchievements: new LocalUserRpgAchievementRepository(),
  rpgQuests: new LocalRpgQuestRepository(),
  tripRpgResults: new LocalTripRpgResultRepository(),
  rpgSettings: new LocalRpgSettingsRepository(),
};
