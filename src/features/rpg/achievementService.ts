import type { RpgAchievementMaster, UserRpgAchievement } from '../../domain/models/rpg';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { createId } from '../../shared/id';
import { grantExperienceOnce } from './experienceService';
import { getConditionValue } from './rpgCondition';
import type { TravelStats } from './rpgStats';

const LOCAL_USER_ID = 'local-user';

export interface AchievementView {
  master: RpgAchievementMaster;
  progress: UserRpgAchievement;
  displayName: string;
  displayDescription: string;
}

export async function refreshAchievements(stats: TravelStats): Promise<UserRpgAchievement[]> {
  const masters = await repositories.rpgAchievementMaster.list();
  const updated: UserRpgAchievement[] = [];

  for (const master of masters) {
    const currentValue = getConditionValue(stats, master.conditionType);
    const existing = await repositories.userRpgAchievements.getByAchievementId(master.id);
    const wasUnlocked = existing?.status === 'unlocked';
    const isUnlocked = wasUnlocked || currentValue >= master.targetValue;
    const now = new Date().toISOString();
    const progress: UserRpgAchievement = {
      id: existing?.id ?? createId('achievement'),
      userId: LOCAL_USER_ID,
      achievementId: master.id,
      currentValue,
      targetValue: master.targetValue,
      status: isUnlocked ? 'unlocked' : currentValue > 0 ? 'in_progress' : 'locked',
      unlockedAt: existing?.unlockedAt ?? (isUnlocked ? now : undefined),
      rewardClaimedAt: existing?.rewardClaimedAt,
      isNew: existing?.isNew ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    if (isUnlocked && !wasUnlocked) {
      progress.isNew = true;
      const result = await grantExperienceOnce({
        amount: master.rewardExp,
        sourceType: 'achievement',
        sourceId: master.id,
        sourceKey: `achievement-unlocked:${master.id}`,
        reason: `${master.name} を解除`,
        metadata: { achievementId: master.id },
      });
      if (result.created) progress.rewardClaimedAt = now;
    }

    updated.push(await repositories.userRpgAchievements.save(progress));
  }

  return updated;
}

export async function listAchievementViews(): Promise<AchievementView[]> {
  const [masters, progressRows] = await Promise.all([
    repositories.rpgAchievementMaster.list(),
    repositories.userRpgAchievements.list(),
  ]);
  const progressById = new Map(progressRows.map((row) => [row.achievementId, row]));
  return masters.map((master) => {
    const progress = progressById.get(master.id) ?? createEmptyAchievementProgress(master);
    const hiddenLocked = master.isHidden && progress.status !== 'unlocked';
    return {
      master,
      progress,
      displayName: hiddenLocked ? '？？？' : master.name,
      displayDescription: hiddenLocked ? '隠し実績です。条件は解除後に表示されます。' : master.description,
    };
  });
}

function createEmptyAchievementProgress(master: RpgAchievementMaster): UserRpgAchievement {
  const now = new Date().toISOString();
  return {
    id: `achievement-progress:${master.id}`,
    userId: LOCAL_USER_ID,
    achievementId: master.id,
    currentValue: 0,
    targetValue: master.targetValue,
    status: 'locked',
    isNew: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  };
}
