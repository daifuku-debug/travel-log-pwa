import type { RpgTitleMaster, UserRpgTitle } from '../../domain/models/rpg';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { createId } from '../../shared/id';
import { getConditionValue } from './rpgCondition';
import type { TravelStats } from './rpgStats';

const LOCAL_USER_ID = 'local-user';

export interface TitleView {
  master: RpgTitleMaster;
  userTitle?: UserRpgTitle;
  progress: number;
  isUnlocked: boolean;
}

export async function refreshTitles(stats: TravelStats): Promise<UserRpgTitle[]> {
  const masters = await repositories.rpgTitleMaster.list();
  const ownedBefore = await repositories.userRpgTitles.list();
  const hasEquippedBefore = ownedBefore.some((title) => title.isEquipped);
  const unlocked: UserRpgTitle[] = [];

  for (const master of masters) {
    const progress = getConditionValue(stats, master.conditionType, master.conditionCategory);
    const existing = await repositories.userRpgTitles.getByTitleId(master.id);
    if (existing && progress < master.conditionValue) {
      await repositories.userRpgTitles.softDelete(existing.id);
      continue;
    }
    if (progress < master.conditionValue) continue;
    if (existing) {
      unlocked.push(await repositories.userRpgTitles.save({ ...existing, progress, updatedAt: new Date().toISOString() }));
      continue;
    }
    const now = new Date().toISOString();
    unlocked.push(await repositories.userRpgTitles.save({
      id: createId('title'),
      userId: LOCAL_USER_ID,
      titleId: master.id,
      unlockedAt: now,
      isNew: true,
      progress,
      isEquipped: !hasEquippedBefore && unlocked.length === 0,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    }));
  }

  return unlocked;
}

export async function listTitleViews(): Promise<TitleView[]> {
  const [masters, owned] = await Promise.all([
    repositories.rpgTitleMaster.list(),
    repositories.userRpgTitles.list(),
  ]);
  const ownedById = new Map(owned.map((title) => [title.titleId, title]));
  return masters.map((master) => {
    const userTitle = ownedById.get(master.id);
    return {
      master,
      userTitle,
      progress: userTitle?.progress ?? 0,
      isUnlocked: Boolean(userTitle),
    };
  });
}

export async function equipTitle(titleId: string): Promise<void> {
  const owned = await repositories.userRpgTitles.list();
  if (!owned.some((title) => title.titleId === titleId)) throw new Error('未獲得の称号です。');
  const now = new Date().toISOString();
  await Promise.all(
    owned.map((title) =>
      repositories.userRpgTitles.save({
        ...title,
        isEquipped: title.titleId === titleId,
        updatedAt: now,
        syncStatus: 'pending',
      }),
    ),
  );
}

export async function getEquippedTitleMaster(): Promise<RpgTitleMaster | undefined> {
  const equipped = await repositories.userRpgTitles.getEquipped();
  return equipped ? repositories.rpgTitleMaster.getById(equipped.titleId) : undefined;
}
