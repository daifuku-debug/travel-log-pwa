import type { PrefectureVisit, PrefectureVisitStatus } from '../../domain/models/japanConquest';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { isValidDateInputValue } from '../../shared/date/dateUtils';
import { toAppError } from '../../shared/errors';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import {
  calculateJapanConquestSummary,
  createEmptyPrefectureVisit,
  filterPrefectureViews,
  mergePrefectureViews,
  type JapanConquestFilters,
} from './japanConquestLogic';

export interface PrefectureVisitInput {
  status: PrefectureVisitStatus;
  firstVisitedAt: string;
  lastVisitedAt: string;
  visitCount: number;
  note: string;
  isFavorite: boolean;
}

export async function getJapanConquestData(filters?: JapanConquestFilters) {
  try {
    await bootstrapAppData();
    const [masters, visits] = await Promise.all([
      repositories.prefectureMaster.list(),
      repositories.prefectureVisits.list(),
    ]);
    const views = mergePrefectureViews(masters, visits);
    return {
      views: filters ? filterPrefectureViews(views, filters) : views,
      allViews: views,
      summary: calculateJapanConquestSummary(views),
    };
  } catch (error) {
    throw toAppError(error, '日本制覇マップの読み込みに失敗しました');
  }
}

export async function updatePrefectureVisit(
  prefectureCode: string,
  input: PrefectureVisitInput,
): Promise<PrefectureVisit> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validatePrefectureVisitInput(input));
    const master = await repositories.prefectureMaster.getByCode(prefectureCode);
    if (!master) throw new Error('都道府県が見つかりません。');

    const now = new Date().toISOString();
    const current =
      (await repositories.prefectureVisits.getByPrefectureCode(prefectureCode)) ??
      createEmptyPrefectureVisit(prefectureCode, now);

    return repositories.prefectureVisits.save({
      ...current,
      status: input.status,
      manualStatus: input.status,
      firstVisitedAt: optionalDate(input.firstVisitedAt),
      lastVisitedAt: optionalDate(input.lastVisitedAt),
      visitCount: Math.max(0, Math.floor(input.visitCount || 0)),
      note: optionalText(input.note),
      isFavorite: input.isFavorite,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, '都道府県の訪問情報の保存に失敗しました');
  }
}

export function validatePrefectureVisitInput(input: PrefectureVisitInput): string[] {
  const errors: string[] = [];
  if (input.firstVisitedAt && !isValidDateInputValue(input.firstVisitedAt)) {
    errors.push('初回訪問日を正しく入力してください。');
  }
  if (input.lastVisitedAt && !isValidDateInputValue(input.lastVisitedAt)) {
    errors.push('最終訪問日を正しく入力してください。');
  }
  if (input.firstVisitedAt && input.lastVisitedAt && input.lastVisitedAt < input.firstVisitedAt) {
    errors.push('最終訪問日は初回訪問日以降にしてください。');
  }
  if (!Number.isFinite(input.visitCount) || input.visitCount < 0) {
    errors.push('訪問回数は0以上の数値にしてください。');
  }
  return errors;
}

function assertNoValidationErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function optionalDate(value: string): string | undefined {
  return value || undefined;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}
