import type {
  JapanRegion,
  PrefectureMaster,
  PrefectureVisit,
  PrefectureVisitStatus,
} from '../../domain/models/japanConquest';

export const PREFECTURE_TOTAL = 47;

export const STATUS_LABELS: Record<PrefectureVisitStatus, string> = {
  unvisited: '未訪問',
  passed: '通過',
  visited: '訪問',
  stayed: '宿泊',
  lived: '居住',
};

export const REGION_LABELS: Record<JapanRegion, string> = {
  hokkaido: '北海道',
  tohoku: '東北',
  kanto: '関東',
  chubu: '中部',
  kinki: '近畿',
  chugoku: '中国',
  shikoku: '四国',
  kyushuOkinawa: '九州・沖縄',
};

const STATUS_PRIORITY: Record<PrefectureVisitStatus, number> = {
  unvisited: 0,
  passed: 1,
  visited: 2,
  stayed: 3,
  lived: 4,
};

export interface PrefectureView {
  master: PrefectureMaster;
  visit: PrefectureVisit;
}

export interface JapanConquestSummary {
  visitedCount: number;
  stayedCount: number;
  livedCount: number;
  passedOnlyCount: number;
  reachedCount: number;
  unvisitedCount: number;
  visitRate: number;
  stayRate: number;
  livedRate: number;
  reachedRate: number;
}

export interface JapanConquestFilters {
  region: JapanRegion | 'all';
  status: PrefectureVisitStatus | 'all';
  favoriteOnly: boolean;
  query: string;
}

export function resolveStatus(
  manualStatus: PrefectureVisitStatus = 'unvisited',
  calculatedStatus: PrefectureVisitStatus = 'unvisited',
): PrefectureVisitStatus {
  return STATUS_PRIORITY[manualStatus] >= STATUS_PRIORITY[calculatedStatus]
    ? manualStatus
    : calculatedStatus;
}

export function createEmptyPrefectureVisit(prefectureCode: string, now: string): PrefectureVisit {
  return {
    id: prefectureCode,
    userId: 'local-user',
    prefectureCode,
    status: 'unvisited',
    manualStatus: 'unvisited',
    calculatedStatus: 'unvisited',
    visitCount: 0,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  };
}

export function mergePrefectureViews(
  masters: PrefectureMaster[],
  visits: PrefectureVisit[],
): PrefectureView[] {
  const visitByCode = new Map(visits.map((visit) => [visit.prefectureCode, visit]));
  const now = new Date().toISOString();
  return masters.map((master) => {
    const visit = visitByCode.get(master.code) ?? createEmptyPrefectureVisit(master.code, now);
    return {
      master,
      visit: {
        ...visit,
        status: resolveStatus(visit.manualStatus ?? visit.status, visit.calculatedStatus),
      },
    };
  });
}

export function calculateJapanConquestSummary(views: PrefectureView[]): JapanConquestSummary {
  const visitedCount = views.filter(({ visit }) => visit.status === 'visited' || visit.status === 'stayed' || visit.status === 'lived').length;
  const stayedCount = views.filter(({ visit }) => visit.status === 'stayed' || visit.status === 'lived').length;
  const livedCount = views.filter(({ visit }) => visit.status === 'lived').length;
  const passedOnlyCount = views.filter(({ visit }) => visit.status === 'passed').length;
  const reachedCount = views.filter(({ visit }) => visit.status !== 'unvisited').length;
  const unvisitedCount = PREFECTURE_TOTAL - reachedCount;

  return {
    visitedCount,
    stayedCount,
    livedCount,
    passedOnlyCount,
    reachedCount,
    unvisitedCount,
    visitRate: roundRate(visitedCount),
    stayRate: roundRate(stayedCount),
    livedRate: roundRate(livedCount),
    reachedRate: roundRate(reachedCount),
  };
}

export function filterPrefectureViews(
  views: PrefectureView[],
  filters: JapanConquestFilters,
): PrefectureView[] {
  const query = filters.query.trim().toLowerCase();
  return views.filter(({ master, visit }) => {
    if (filters.region !== 'all' && master.region !== filters.region) return false;
    if (filters.status !== 'all' && visit.status !== filters.status) return false;
    if (filters.favoriteOnly && !visit.isFavorite) return false;
    if (!query) return true;
    return master.nameJa.includes(query) || master.nameEn.toLowerCase().includes(query);
  });
}

function roundRate(count: number): number {
  return Math.round((count / PREFECTURE_TOTAL) * 1000) / 10;
}
