import type { EntityId } from '../../domain/models/common.ts';
import type { ManualTimelineEntry } from '../../domain/models/timeMachine.ts';
import { repositories } from '../../infrastructure/repositories/repositoryFactory.ts';
import { toAppError } from '../../shared/errors.ts';
import { createId } from '../../shared/id.ts';
import { bootstrapAppData } from '../bootstrap/bootstrapService.ts';
import {
  buildQuickTravelRecordFields,
  isQuickTravelRecord,
  type QuickTravelRecordInput,
  validateQuickTravelRecordInput,
} from './quickTravelRecord.ts';

const LOCAL_USER_ID = 'local-user';

export async function listTripQuickTravelRecords(tripId: EntityId): Promise<ManualTimelineEntry[]> {
  try {
    await bootstrapAppData();
    return (await repositories.manualTimelineEntries.listByTripId(tripId))
      .filter(isQuickTravelRecord)
      .sort((left, right) => String(right.startAt || right.createdAt).localeCompare(String(left.startAt || left.createdAt)));
  } catch (error) {
    throw toAppError(error, 'クイック記録の読み込みに失敗しました');
  }
}

export async function createQuickTravelRecord(
  tripId: EntityId,
  input: QuickTravelRecordInput,
  now = new Date(),
): Promise<ManualTimelineEntry> {
  try {
    await bootstrapAppData();
    assertValidInput(input);
    if (Number.isNaN(now.getTime())) throw new Error('現在日時を確認してください。');
    const trip = await repositories.trips.getById(tripId);
    if (!trip) throw new Error('旅行が見つかりません。');
    const place = await resolvePlace(tripId, input.placeVisitId);
    const timestamp = now.toISOString();
    return repositories.manualTimelineEntries.save({
      id: createId('quick-record'),
      userId: LOCAL_USER_ID,
      tripId,
      ...buildQuickTravelRecordFields(input, place),
      sourceType: 'manual',
      confidence: 'exact',
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '旅先の記録を保存できませんでした');
  }
}

export async function updateQuickTravelRecord(
  entryId: EntityId,
  input: QuickTravelRecordInput,
): Promise<ManualTimelineEntry> {
  try {
    await bootstrapAppData();
    assertValidInput(input);
    const current = await repositories.manualTimelineEntries.getById(entryId);
    if (!current || !current.tripId || !isQuickTravelRecord(current)) throw new Error('記録が見つかりません。');
    const place = await resolvePlace(current.tripId, input.placeVisitId);
    return repositories.manualTimelineEntries.save({
      ...current,
      ...buildQuickTravelRecordFields(input, place),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '旅先の記録を更新できませんでした');
  }
}

async function resolvePlace(tripId: EntityId, placeVisitId: string) {
  if (!placeVisitId) return undefined;
  const place = await repositories.placeVisits.getById(placeVisitId);
  if (!place || place.tripId !== tripId) throw new Error('関連付ける訪問場所を確認してください。');
  return place;
}

function assertValidInput(input: QuickTravelRecordInput): void {
  const errors = validateQuickTravelRecordInput(input);
  if (errors.length > 0) throw new Error(errors.join('\n'));
}
