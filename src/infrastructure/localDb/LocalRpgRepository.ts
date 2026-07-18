import achievementMasterData from '../../domain/rpg/achievementMaster.json';
import questMasterData from '../../domain/rpg/questMaster.json';
import titleMasterData from '../../domain/rpg/titleMaster.json';
import type {
  RpgAchievementMaster,
  RpgExperienceEntry,
  RpgQuest,
  RpgSettings,
  RpgTitleMaster,
  TripRpgResult,
  UserRpgAchievement,
  UserRpgTitle,
} from '../../domain/models/rpg';
import type {
  RpgAchievementMasterRepository,
  RpgExperienceRepository,
  RpgQuestRepository,
  RpgSettingsRepository,
  RpgTitleMasterRepository,
  TripRpgResultRepository,
  UserRpgAchievementRepository,
  UserRpgTitleRepository,
} from '../../domain/repositories/RpgRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalRpgExperienceRepository
  extends LocalBaseRepository<RpgExperienceEntry>
  implements RpgExperienceRepository
{
  constructor() {
    super('rpgExperienceEntries');
  }

  async getBySourceKey(sourceKey: string): Promise<RpgExperienceEntry | undefined> {
    const entries = await this.list();
    return entries.find((entry) => entry.sourceKey === sourceKey);
  }

  async listRecent(limit: number): Promise<RpgExperienceEntry[]> {
    const entries = await this.list();
    return entries
      .slice()
      .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
      .slice(0, limit);
  }
}

export class StaticRpgTitleMasterRepository implements RpgTitleMasterRepository {
  private readonly titles = titleMasterData as RpgTitleMaster[];

  async list(): Promise<RpgTitleMaster[]> {
    return this.titles.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getById(id: string): Promise<RpgTitleMaster | undefined> {
    return this.titles.find((title) => title.id === id);
  }
}

export class LocalUserRpgTitleRepository
  extends LocalBaseRepository<UserRpgTitle>
  implements UserRpgTitleRepository
{
  constructor() {
    super('userRpgTitles');
  }

  async getByTitleId(titleId: string): Promise<UserRpgTitle | undefined> {
    const titles = await this.list();
    return titles.find((title) => title.titleId === titleId);
  }

  async getEquipped(): Promise<UserRpgTitle | undefined> {
    const titles = await this.list();
    return titles.find((title) => title.isEquipped);
  }
}

export class StaticRpgAchievementMasterRepository implements RpgAchievementMasterRepository {
  private readonly achievements = achievementMasterData as RpgAchievementMaster[];

  async list(): Promise<RpgAchievementMaster[]> {
    return this.achievements.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getById(id: string): Promise<RpgAchievementMaster | undefined> {
    return this.achievements.find((achievement) => achievement.id === id);
  }
}

export class LocalUserRpgAchievementRepository
  extends LocalBaseRepository<UserRpgAchievement>
  implements UserRpgAchievementRepository
{
  constructor() {
    super('userRpgAchievements');
  }

  async getByAchievementId(achievementId: string): Promise<UserRpgAchievement | undefined> {
    const achievements = await this.list();
    return achievements.find((achievement) => achievement.achievementId === achievementId);
  }
}

export class LocalRpgQuestRepository
  extends LocalBaseRepository<RpgQuest>
  implements RpgQuestRepository
{
  private readonly systemQuestTemplates = questMasterData as Array<Omit<RpgQuest, 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'currentValue' | 'status'>>;

  constructor() {
    super('rpgQuests');
  }

  async list(): Promise<RpgQuest[]> {
    const [saved, system] = await Promise.all([super.list(), this.buildSystemQuests()]);
    const savedIds = new Set(saved.map((quest) => quest.id));
    return [...system.filter((quest) => !savedIds.has(quest.id)), ...saved];
  }

  async listSaved(): Promise<RpgQuest[]> {
    return super.list();
  }

  async listByStatus(status: RpgQuest['status']): Promise<RpgQuest[]> {
    const quests = await this.list();
    return quests.filter((quest) => quest.status === status);
  }

  private async buildSystemQuests(): Promise<RpgQuest[]> {
    const now = new Date().toISOString();
    return this.systemQuestTemplates.map((quest) => ({
      ...quest,
      userId: 'local-user',
      currentValue: 0,
      status: 'available',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    }));
  }
}

export class LocalTripRpgResultRepository
  extends LocalBaseRepository<TripRpgResult>
  implements TripRpgResultRepository
{
  constructor() {
    super('tripRpgResults');
  }

  async getByTripId(tripId: string): Promise<TripRpgResult | undefined> {
    const results = await this.list();
    return results.find((result) => result.tripId === tripId);
  }
}

export class LocalRpgSettingsRepository
  extends LocalBaseRepository<RpgSettings>
  implements RpgSettingsRepository
{
  constructor() {
    super('rpgSettings');
  }

  async getSingleton(): Promise<RpgSettings | undefined> {
    return this.getById('rpg-settings');
  }
}
