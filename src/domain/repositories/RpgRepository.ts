import type { EntityId } from '../models/common';
import type {
  RpgAchievementMaster,
  RpgExperienceEntry,
  RpgQuest,
  RpgSettings,
  RpgTitleMaster,
  TripRpgResult,
  UserRpgAchievement,
  UserRpgTitle,
} from '../models/rpg';
import type { BaseRepository } from './BaseRepository';

export interface RpgExperienceRepository extends BaseRepository<RpgExperienceEntry> {
  getBySourceKey(sourceKey: string): Promise<RpgExperienceEntry | undefined>;
  listRecent(limit: number): Promise<RpgExperienceEntry[]>;
}

export interface RpgTitleMasterRepository {
  list(): Promise<RpgTitleMaster[]>;
  getById(id: string): Promise<RpgTitleMaster | undefined>;
}

export interface UserRpgTitleRepository extends BaseRepository<UserRpgTitle> {
  getByTitleId(titleId: string): Promise<UserRpgTitle | undefined>;
  getEquipped(): Promise<UserRpgTitle | undefined>;
}

export interface RpgAchievementMasterRepository {
  list(): Promise<RpgAchievementMaster[]>;
  getById(id: string): Promise<RpgAchievementMaster | undefined>;
}

export interface UserRpgAchievementRepository extends BaseRepository<UserRpgAchievement> {
  getByAchievementId(achievementId: string): Promise<UserRpgAchievement | undefined>;
}

export interface RpgQuestRepository extends BaseRepository<RpgQuest> {
  listByStatus(status: RpgQuest['status']): Promise<RpgQuest[]>;
}

export interface TripRpgResultRepository extends BaseRepository<TripRpgResult> {
  getByTripId(tripId: EntityId): Promise<TripRpgResult | undefined>;
}

export interface RpgSettingsRepository extends BaseRepository<RpgSettings> {
  getSingleton(): Promise<RpgSettings | undefined>;
}
