import type { CastleMaster, CastleSeries, CastleVisitSummary, CastleVisitStatus } from '../../domain/models/castle';
import type { EntityId, IsoDateString } from '../../domain/models/common';
import { isValidDateInputValue, todayDateInputValue } from '../../shared/date/dateUtils.ts';

export const CASTLE_TOTAL_COUNT = 200;

export const CASTLE_SERIES_LABELS: Record<CastleSeries, string> = {
  japanese_100_castles: '日本100名城',
  continued_japanese_100_castles: '続日本100名城',
};

export const CASTLE_STATUS_LABELS: Record<CastleVisitStatus, string> = {
  unvisited: '未訪問',
  planned: '行きたい',
  visited: '登城済み',
};

export interface CastleRecordInput {
  status: CastleVisitStatus;
  firstVisitedAt: string;
  lastVisitedAt: string;
  visitCount: number;
  stampStatus: CastleVisitSummary['stampStatus'];
  stampAcquiredAt: string;
  goshuinStatus: CastleVisitSummary['goshuinStatus'];
  goshuinAcquiredAt: string;
  rating: string;
  isFavorite: boolean;
  note: string;
}

export interface CastleFilter {
  query: string;
  region: string;
  prefectureCode: string;
  series: CastleSeries | 'all';
  status: CastleVisitStatus | 'all';
  stampStatus: CastleVisitSummary['stampStatus'] | 'all';
  goshuinStatus: CastleVisitSummary['goshuinStatus'] | 'all';
  favoriteOnly: boolean;
  sort: 'official' | 'name' | 'recent' | 'visitCount';
}

export interface CastleListRow {
  castle: CastleMaster;
  summary: CastleVisitSummary;
}

export interface CastleCollectionStats {
  totalCount: number;
  japanese100Total: number;
  continued100Total: number;
  visitedCount: number;
  japanese100VisitedCount: number;
  continued100VisitedCount: number;
  plannedCount: number;
  unvisitedCount: number;
  stampCount: number;
  goshuinCount: number;
  favoriteCount: number;
  revisitCount: number;
  visitedRate: number;
  japanese100VisitedRate: number;
  continued100VisitedRate: number;
  stampRate: number;
  goshuinRate: number;
}

export function createEmptyCastleSummary(castleId: EntityId, now: string): CastleVisitSummary {
  return {
    id: castleId,
    userId: 'local-user',
    castleId,
    status: 'unvisited',
    visitCount: 0,
    stampStatus: 'unknown',
    goshuinStatus: 'unknown',
    isFavorite: false,
    relatedTripIds: [],
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  };
}

export function mergeCastleRows(
  castles: CastleMaster[],
  summaries: CastleVisitSummary[],
): CastleListRow[] {
  const now = new Date().toISOString();
  const summariesByCastleId = new Map(summaries.map((summary) => [summary.castleId, summary]));
  return castles.map((castle) => ({
    castle,
    summary: summariesByCastleId.get(castle.id) ?? createEmptyCastleSummary(castle.id, now),
  }));
}

export function calculateCastleStats(rows: CastleListRow[]): CastleCollectionStats {
  const visitedRows = rows.filter((row) => row.summary.status === 'visited');
  const j100Rows = rows.filter((row) => row.castle.series === 'japanese_100_castles');
  const zokuRows = rows.filter((row) => row.castle.series === 'continued_japanese_100_castles');
  const j100Visited = j100Rows.filter((row) => row.summary.status === 'visited').length;
  const zokuVisited = zokuRows.filter((row) => row.summary.status === 'visited').length;
  const stampCount = rows.filter((row) => row.summary.stampStatus === 'acquired').length;
  const goshuinCount = rows.filter((row) => row.summary.goshuinStatus === 'acquired').length;

  return {
    totalCount: rows.length,
    japanese100Total: j100Rows.length,
    continued100Total: zokuRows.length,
    visitedCount: visitedRows.length,
    japanese100VisitedCount: j100Visited,
    continued100VisitedCount: zokuVisited,
    plannedCount: rows.filter((row) => row.summary.status === 'planned').length,
    unvisitedCount: rows.filter((row) => row.summary.status === 'unvisited').length,
    stampCount,
    goshuinCount,
    favoriteCount: rows.filter((row) => row.summary.isFavorite).length,
    revisitCount: rows.reduce((sum, row) => sum + Math.max(row.summary.visitCount - 1, 0), 0),
    visitedRate: percentage(visitedRows.length, rows.length),
    japanese100VisitedRate: percentage(j100Visited, j100Rows.length),
    continued100VisitedRate: percentage(zokuVisited, zokuRows.length),
    stampRate: percentage(stampCount, rows.length),
    goshuinRate: percentage(goshuinCount, rows.length),
  };
}

export function filterCastleRows(rows: CastleListRow[], filter: CastleFilter): CastleListRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows
    .filter(({ castle, summary }) => {
      if (query && ![castle.nameJa, castle.nameKana, castle.nameEn, castle.municipality, castle.prefectureName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))) {
        return false;
      }
      if (filter.region !== 'all' && castle.region !== filter.region) return false;
      if (filter.prefectureCode !== 'all' && castle.prefectureCode !== filter.prefectureCode) return false;
      if (filter.series !== 'all' && castle.series !== filter.series) return false;
      if (filter.status !== 'all' && summary.status !== filter.status) return false;
      if (filter.stampStatus !== 'all' && summary.stampStatus !== filter.stampStatus) return false;
      if (filter.goshuinStatus !== 'all' && summary.goshuinStatus !== filter.goshuinStatus) return false;
      if (filter.favoriteOnly && !summary.isFavorite) return false;
      return true;
    })
    .sort((a, b) => compareCastleRows(a, b, filter.sort));
}

export function validateCastleRecordInput(input: CastleRecordInput): string[] {
  const errors: string[] = [];
  if (!['unvisited', 'planned', 'visited'].includes(input.status)) errors.push('訪問状態が不正です。');
  if (input.firstVisitedAt && !isValidDateInputValue(input.firstVisitedAt)) errors.push('初回訪問日を正しい日付で入力してください。');
  if (input.lastVisitedAt && !isValidDateInputValue(input.lastVisitedAt)) errors.push('最終訪問日を正しい日付で入力してください。');
  if (input.stampAcquiredAt && !isValidDateInputValue(input.stampAcquiredAt)) errors.push('スタンプ取得日を正しい日付で入力してください。');
  if (input.goshuinAcquiredAt && !isValidDateInputValue(input.goshuinAcquiredAt)) errors.push('御城印取得日を正しい日付で入力してください。');
  if (!Number.isInteger(input.visitCount) || input.visitCount < 0) errors.push('訪問回数は0以上の整数で入力してください。');
  if (input.firstVisitedAt && input.lastVisitedAt && input.firstVisitedAt > input.lastVisitedAt) {
    errors.push('初回訪問日は最終訪問日以前にしてください。');
  }
  if (input.rating.trim()) {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push('評価は1〜5で入力してください。');
  }
  return errors;
}

export function buildCastleSummaryFromInput(
  castleId: EntityId,
  current: CastleVisitSummary | undefined,
  input: CastleRecordInput,
  now: string,
): CastleVisitSummary {
  const visitedDate = input.lastVisitedAt || input.firstVisitedAt || todayDateInputValue();
  const isVisited = input.status === 'visited';
  const visitCount = isVisited ? Math.max(input.visitCount, 1) : input.visitCount;
  const firstVisitedAt = optionalDate(input.firstVisitedAt) ?? (isVisited ? current?.firstVisitedAt ?? visitedDate : undefined);
  const lastVisitedAt = optionalDate(input.lastVisitedAt) ?? (isVisited ? visitedDate : undefined);

  return {
    ...(current ?? createEmptyCastleSummary(castleId, now)),
    id: castleId,
    castleId,
    status: input.status,
    firstVisitedAt,
    lastVisitedAt,
    visitCount,
    stampStatus: input.stampStatus,
    stampAcquiredAt: optionalDate(input.stampAcquiredAt),
    goshuinStatus: input.goshuinStatus,
    goshuinAcquiredAt: optionalDate(input.goshuinAcquiredAt),
    rating: input.rating.trim() ? Number(input.rating) : undefined,
    isFavorite: input.isFavorite,
    note: optionalText(input.note),
    relatedTripIds: current?.relatedTripIds ?? [],
    updatedAt: now,
    syncStatus: 'pending',
  };
}

function compareCastleRows(a: CastleListRow, b: CastleListRow, sort: CastleFilter['sort']): number {
  if (sort === 'name') return a.castle.nameJa.localeCompare(b.castle.nameJa, 'ja');
  if (sort === 'recent') return (b.summary.lastVisitedAt ?? '').localeCompare(a.summary.lastVisitedAt ?? '') || a.castle.sortOrder - b.castle.sortOrder;
  if (sort === 'visitCount') return b.summary.visitCount - a.summary.visitCount || a.castle.sortOrder - b.castle.sortOrder;
  return a.castle.sortOrder - b.castle.sortOrder;
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalDate(value: string): IsoDateString | undefined {
  return value.trim() || undefined;
}
