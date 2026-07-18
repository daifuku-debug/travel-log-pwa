import type { RpgSettings } from '../../domain/models/rpg';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';

const LOCAL_USER_ID = 'local-user';
export const CURRENT_RPG_MIGRATION_VERSION = 1;

export async function getRpgSettings(): Promise<RpgSettings> {
  const existing = await repositories.rpgSettings.getSingleton();
  if (existing) return existing;

  const now = new Date().toISOString();
  return repositories.rpgSettings.save({
    id: 'rpg-settings',
    userId: LOCAL_USER_ID,
    rpgEnabled: true,
    levelUpAnimationEnabled: true,
    achievementNotificationsEnabled: true,
    includeCustomQuestExpInLevel: false,
    includeExistingDataInInitialAggregation: true,
    rpgMigrationVersion: 0,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  });
}

export async function updateRpgSettings(
  input: Partial<Pick<
    RpgSettings,
    | 'rpgEnabled'
    | 'levelUpAnimationEnabled'
    | 'achievementNotificationsEnabled'
    | 'includeCustomQuestExpInLevel'
    | 'includeExistingDataInInitialAggregation'
  >>,
): Promise<RpgSettings> {
  const current = await getRpgSettings();
  return repositories.rpgSettings.save({
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  });
}
