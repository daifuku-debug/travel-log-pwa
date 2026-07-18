import type { EntityId } from '../../domain/models/common';
import type { QuestStatus, RpgQuest } from '../../domain/models/rpg';
import experienceRules from '../../domain/rpg/experienceRules.json';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { isValidDateInputValue } from '../../shared/date/dateUtils';
import { createId } from '../../shared/id';
import { grantExperienceOnce } from './experienceService';
import { getConditionValue } from './rpgCondition';
import type { TravelStats } from './rpgStats';

const LOCAL_USER_ID = 'local-user';
const CUSTOM_REWARD_MAX = experienceRules.customQuestRewardMax;

export interface CustomQuestInput {
  title: string;
  description: string;
  expiresAt: string;
  targetValue: number;
  rewardExp: number;
  category: string;
  conditionType: RpgQuest['conditionType'];
  note: string;
}

export async function refreshQuests(stats: TravelStats): Promise<RpgQuest[]> {
  const quests = await repositories.rpgQuests.list();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const updated: RpgQuest[] = [];

  for (const quest of quests) {
    const isExpired = quest.expiresAt && quest.expiresAt < today && quest.status !== 'claimed';
    const currentValue = quest.conditionType === 'manual'
      ? quest.currentValue
      : Math.min(getConditionValue(stats, quest.conditionType), quest.targetValue);
    const completed = currentValue >= quest.targetValue;
    const status: QuestStatus = isExpired
      ? 'expired'
      : quest.status === 'claimed'
        ? 'claimed'
        : completed
          ? 'completed'
          : currentValue > 0
            ? 'in_progress'
            : 'available';
    const nextQuest = {
      ...quest,
      currentValue,
      status,
      completedAt: quest.completedAt ?? (status === 'completed' || status === 'claimed' ? now : undefined),
      updatedAt: now,
    };

    if (nextQuest.status === 'completed' && !nextQuest.rewardClaimedAt) {
      await grantExperienceOnce({
        amount: nextQuest.rewardExp,
        sourceType: 'quest',
        sourceId: nextQuest.id,
        sourceKey: `quest-completed:${nextQuest.id}`,
        reason: `${nextQuest.title} を達成`,
        metadata: { questId: nextQuest.id, questSource: nextQuest.source },
        includeInLevel: nextQuest.source === 'system',
      });
      nextQuest.rewardClaimedAt = now;
      nextQuest.status = 'claimed';
    }

    updated.push(nextQuest.source === 'user' ? await repositories.rpgQuests.save(nextQuest) : nextQuest);
  }

  return updated;
}

export async function listQuests(): Promise<RpgQuest[]> {
  const quests = await repositories.rpgQuests.list();
  return quests.slice().sort((a, b) => questSortValue(a) - questSortValue(b));
}

export async function createCustomQuest(input: CustomQuestInput): Promise<RpgQuest> {
  assertNoValidationErrors(validateCustomQuestInput(input));
  const now = new Date().toISOString();
  return repositories.rpgQuests.save({
    id: createId('quest'),
    userId: LOCAL_USER_ID,
    type: 'custom',
    source: 'user',
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim() || '自由',
    conditionType: input.conditionType,
    targetValue: Math.max(1, Math.floor(input.targetValue)),
    currentValue: 0,
    rewardExp: clampCustomReward(input.rewardExp),
    expiresAt: input.expiresAt || undefined,
    status: 'available',
    isRepeatable: false,
    note: input.note.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  });
}

export async function updateCustomQuest(questId: EntityId, input: CustomQuestInput): Promise<RpgQuest> {
  assertNoValidationErrors(validateCustomQuestInput(input));
  const current = await repositories.rpgQuests.getById(questId);
  if (!current || current.source !== 'user') throw new Error('ユーザー作成クエストが見つかりません。');
  return repositories.rpgQuests.save({
    ...current,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim() || '自由',
    conditionType: input.conditionType,
    targetValue: Math.max(1, Math.floor(input.targetValue)),
    rewardExp: clampCustomReward(input.rewardExp),
    expiresAt: input.expiresAt || undefined,
    note: input.note.trim() || undefined,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  });
}

export async function deleteCustomQuest(questId: EntityId): Promise<void> {
  const current = await repositories.rpgQuests.getById(questId);
  if (!current || current.source !== 'user') throw new Error('ユーザー作成クエストが見つかりません。');
  await repositories.rpgQuests.softDelete(questId);
}

export async function completeCustomQuest(questId: EntityId): Promise<RpgQuest> {
  const current = await repositories.rpgQuests.getById(questId);
  if (!current || current.source !== 'user') throw new Error('ユーザー作成クエストが見つかりません。');
  const now = new Date().toISOString();
  await grantExperienceOnce({
    amount: current.rewardExp,
    sourceType: 'quest',
    sourceId: current.id,
    sourceKey: `quest-completed:${current.id}`,
    reason: `${current.title} を達成`,
    metadata: { questId: current.id, questSource: current.source },
    includeInLevel: false,
  });
  return repositories.rpgQuests.save({
    ...current,
    currentValue: current.targetValue,
    status: 'claimed',
    completedAt: current.completedAt ?? now,
    rewardClaimedAt: current.rewardClaimedAt ?? now,
    updatedAt: now,
    syncStatus: 'pending',
  });
}

export function validateCustomQuestInput(input: CustomQuestInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('クエスト名を入力してください。');
  if (!input.description.trim()) errors.push('説明を入力してください。');
  if (input.expiresAt && !isValidDateInputValue(input.expiresAt)) errors.push('期限を正しく入力してください。');
  if (!Number.isFinite(input.targetValue) || input.targetValue < 1) errors.push('目標回数は1以上にしてください。');
  if (!Number.isFinite(input.rewardExp) || input.rewardExp < 0) errors.push('報酬EXPは0以上にしてください。');
  if (input.rewardExp > CUSTOM_REWARD_MAX) errors.push(`報酬EXPは${CUSTOM_REWARD_MAX}以下にしてください。`);
  return errors;
}

export function clampCustomReward(value: number): number {
  return Math.min(CUSTOM_REWARD_MAX, Math.max(0, Math.floor(value || 0)));
}

function questSortValue(quest: RpgQuest): number {
  const typeOrder: Record<RpgQuest['type'], number> = { permanent: 1, daily: 2, weekly: 3, custom: 4 };
  return typeOrder[quest.type] * 100 + (quest.status === 'claimed' ? 20 : quest.status === 'completed' ? 0 : 10);
}

function assertNoValidationErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}
