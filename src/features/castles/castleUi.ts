import type { CastleFilter } from './castleLogic';
export { CASTLE_SERIES_LABELS, CASTLE_STATUS_LABELS } from './castleLogic';

export const REGION_LABELS: Record<string, string> = {
  hokkaido: '北海道',
  tohoku: '東北',
  kanto: '関東',
  chubu: '中部',
  kinki: '近畿',
  chugoku: '中国',
  shikoku: '四国',
  kyushu_okinawa: '九州・沖縄',
};

export function getDefaultCastleFilter(): CastleFilter {
  return {
    query: '',
    region: 'all',
    prefectureCode: 'all',
    series: 'all',
    status: 'all',
    stampStatus: 'all',
    goshuinStatus: 'all',
    favoriteOnly: false,
    sort: 'official',
  };
}
