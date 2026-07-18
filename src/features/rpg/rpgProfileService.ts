import type { RpgLevelProgress } from '../../domain/models/rpg';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { listAchievementViews } from './achievementService';
import { listRecentExperience } from './experienceService';
import { listQuests, refreshQuests } from './questService';
import { calculateLevelProgress } from './rpgLevel';
import { ensureRpgProgressInitialized, refreshRpgProgress } from './rpgProgressService';
import { getRpgSettings } from './rpgSettingsService';
import { getTravelStats } from './rpgStatsService';
import { getEquippedTitleMaster, listTitleViews } from './titleService';

export interface RpgProfile {
  level: RpgLevelProgress;
  mainTitleName: string;
  stats: Awaited<ReturnType<typeof getTravelStats>>;
  recentExperience: Awaited<ReturnType<typeof listRecentExperience>>;
  recentAchievements: Awaited<ReturnType<typeof listAchievementViews>>;
  inProgressQuests: Awaited<ReturnType<typeof listQuests>>;
  nextAchievements: Awaited<ReturnType<typeof listAchievementViews>>;
  unlockedAchievementCount: number;
  ownedTitleCount: number;
}

export async function getRpgProfile(): Promise<RpgProfile> {
  try {
    await ensureRpgProgressInitialized();
    const [settings, stats] = await Promise.all([
      getRpgSettings(),
      getTravelStats(),
    ]);
    if (settings.rpgEnabled) {
      await refreshRpgProgress();
      await refreshQuests(stats);
    }
    const [title, entries, achievements, titles, quests] = await Promise.all([
      getEquippedTitleMaster(),
      repositories.rpgExperienceEntries.list(),
      listAchievementViews(),
      listTitleViews(),
      listQuests(),
    ]);
    const level = calculateLevelProgress(entries);
    const unlockedAchievements = achievements.filter((view) => view.progress.status === 'unlocked');
    const inProgressAchievements = achievements
      .filter((view) => view.progress.status !== 'unlocked' && !view.master.isHidden)
      .sort((a, b) => progressRate(b) - progressRate(a));

    return {
      level,
      mainTitleName: title?.name ?? '旅人',
      stats,
      recentExperience: await listRecentExperience(8),
      recentAchievements: unlockedAchievements.slice(-5).reverse(),
      inProgressQuests: quests.filter((quest) => quest.status === 'available' || quest.status === 'in_progress').slice(0, 5),
      nextAchievements: inProgressAchievements.slice(0, 5),
      unlockedAchievementCount: unlockedAchievements.length,
      ownedTitleCount: titles.filter((view) => view.isUnlocked).length,
    };
  } catch (error) {
    throw toAppError(error, '冒険者プロフィールの読み込みに失敗しました');
  }
}

function progressRate(view: Awaited<ReturnType<typeof listAchievementViews>>[number]): number {
  return view.progress.targetValue === 0 ? 0 : view.progress.currentValue / view.progress.targetValue;
}
