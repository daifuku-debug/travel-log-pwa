import { clearStore } from '../../infrastructure/localDb/db';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { ensureRpgProgressInitialized } from './rpgProgressService';

const RPG_STORES = [
  'rpgExperienceEntries',
  'userRpgTitles',
  'userRpgAchievements',
  'rpgQuests',
  'tripRpgResults',
  'rpgSettings',
] as const;

export async function resetRpgDataOnly(): Promise<void> {
  await Promise.all(RPG_STORES.map((storeName) => clearStore(storeName)));
}

export async function rerunInitialRpgAggregation(): Promise<void> {
  const settings = await repositories.rpgSettings.getSingleton();
  if (settings) {
    await repositories.rpgSettings.save({
      ...settings,
      initialAggregationCompletedAt: undefined,
      rpgMigrationVersion: 0,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  }
  await ensureRpgProgressInitialized();
}
