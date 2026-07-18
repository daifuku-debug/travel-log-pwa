import type { EntityId } from '../../domain/models/common';
import type { RpgExperienceEntry, RpgSourceType } from '../../domain/models/rpg';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { createId } from '../../shared/id';
import { getRpgSettings } from './rpgSettingsService';

const LOCAL_USER_ID = 'local-user';

export interface GrantExperienceInput {
  amount: number;
  sourceType: RpgSourceType;
  sourceKey: string;
  reason: string;
  sourceId?: EntityId;
  metadata?: Record<string, unknown>;
  includeInLevel?: boolean;
}

export async function grantExperienceOnce(
  input: GrantExperienceInput,
): Promise<{ entry?: RpgExperienceEntry; created: boolean }> {
  if (input.amount < 0) throw new Error('経験値は0以上である必要があります。');
  const existing = await repositories.rpgExperienceEntries.getBySourceKey(input.sourceKey);
  if (existing) return { entry: existing, created: false };

  const settings = await getRpgSettings();
  const defaultIncludeInLevel =
    input.sourceType !== 'quest' || input.metadata?.questSource !== 'user' || settings.includeCustomQuestExpInLevel;
  const includeInLevel = input.includeInLevel ?? defaultIncludeInLevel;
  const now = new Date().toISOString();
  const entry = await repositories.rpgExperienceEntries.save({
    id: createId('exp'),
    userId: LOCAL_USER_ID,
    amount: Math.floor(input.amount),
    effectiveAmount: includeInLevel ? Math.floor(input.amount) : 0,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceKey: input.sourceKey,
    reason: input.reason,
    earnedAt: now,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  });

  return { entry, created: true };
}

export async function listRecentExperience(limit = 10): Promise<RpgExperienceEntry[]> {
  return repositories.rpgExperienceEntries.listRecent(limit);
}
