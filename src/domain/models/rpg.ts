import type { BaseEntity, EntityId, IsoDateString, IsoDateTimeString } from './common';

export type RpgSourceType =
  | 'trip'
  | 'prefecture'
  | 'collection'
  | 'castle'
  | 'achievement'
  | 'quest'
  | 'manual'
  | 'system';

export type AchievementStatus = 'locked' | 'in_progress' | 'unlocked';
export type QuestType = 'permanent' | 'daily' | 'weekly' | 'custom';
export type QuestSource = 'system' | 'user';
export type QuestStatus = 'available' | 'in_progress' | 'completed' | 'claimed' | 'expired';
export type RpgConditionType =
  | 'tripCompletedCount'
  | 'dayTripCompletedCount'
  | 'overnightTripCompletedCount'
  | 'placeVisitCount'
  | 'prefectureVisitedCount'
  | 'prefectureStayedCount'
  | 'collectionCompletedCount'
  | 'collectionCategoryCompletedCount'
  | 'castleVisitedCount'
  | 'castleJapanese100VisitedCount'
  | 'castleContinued100VisitedCount'
  | 'castleStampCount'
  | 'castleGoshuinCount'
  | 'samePrefectureVisitCount'
  | 'wishlistItemCount'
  | 'manual';

export interface RpgExperienceEntry extends BaseEntity {
  amount: number;
  effectiveAmount: number;
  sourceType: RpgSourceType;
  sourceId?: EntityId;
  sourceKey: string;
  reason: string;
  earnedAt: IsoDateTimeString;
  metadata?: Record<string, unknown>;
}

export interface RpgTitleMaster {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  conditionType: RpgConditionType;
  conditionValue: number;
  conditionCategory?: string;
  sortOrder: number;
  isHidden: boolean;
}

export interface UserRpgTitle extends BaseEntity {
  titleId: string;
  unlockedAt: IsoDateTimeString;
  isNew: boolean;
  progress: number;
  isEquipped: boolean;
}

export interface RpgAchievementMaster {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  conditionType: RpgConditionType;
  targetValue: number;
  rewardExp: number;
  isHidden: boolean;
  sortOrder: number;
}

export interface UserRpgAchievement extends BaseEntity {
  achievementId: string;
  currentValue: number;
  targetValue: number;
  status: AchievementStatus;
  unlockedAt?: IsoDateTimeString;
  rewardClaimedAt?: IsoDateTimeString;
  isNew: boolean;
}

export interface RpgQuest extends BaseEntity {
  type: QuestType;
  source: QuestSource;
  title: string;
  description: string;
  category: string;
  conditionType: RpgConditionType;
  targetValue: number;
  currentValue: number;
  rewardExp: number;
  startsAt?: IsoDateString;
  expiresAt?: IsoDateString;
  status: QuestStatus;
  completedAt?: IsoDateTimeString;
  rewardClaimedAt?: IsoDateTimeString;
  isRepeatable: boolean;
  note?: string;
}

export interface TripRpgResult extends BaseEntity {
  tripId: EntityId;
  generatedAt: IsoDateTimeString;
  expEntryIds: EntityId[];
  totalExp: number;
  oldLevel: number;
  newLevel: number;
  unlockedAchievementIds: string[];
  unlockedTitleIds: string[];
  progressedQuestIds: EntityId[];
  summary: {
    placeVisitCount: number;
    newPrefectureCodes: string[];
    firstStayedPrefectureCodes: string[];
    collectionVisitCount: number;
  };
}

export interface RpgSettings extends BaseEntity {
  rpgEnabled: boolean;
  levelUpAnimationEnabled: boolean;
  achievementNotificationsEnabled: boolean;
  includeCustomQuestExpInLevel: boolean;
  includeExistingDataInInitialAggregation: boolean;
  rpgMigrationVersion: number;
  initialAggregationCompletedAt?: IsoDateTimeString;
}

export interface RpgLevelProgress {
  currentLevel: number;
  currentExp: number;
  totalExp: number;
  expToNextLevel: number;
  levelStartTotalExp: number;
  nextLevelTotalExp: number;
  lastLevelUpAt?: IsoDateTimeString;
}
