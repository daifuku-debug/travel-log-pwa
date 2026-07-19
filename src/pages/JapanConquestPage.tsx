import { useMemo, useState } from 'react';
import type { JapanRegion, PrefectureVisitStatus } from '../domain/models/japanConquest';
import { JapanGeoMap } from '../features/japanConquest/components/JapanGeoMap';
import { PrefectureDetailPanel } from '../features/japanConquest/components/PrefectureDetailPanel';
import {
  REGION_LABELS,
  STATUS_LABELS,
  filterPrefectureViews,
  type JapanConquestFilters,
} from '../features/japanConquest/japanConquestLogic';
import { getJapanConquestData } from '../features/japanConquest/japanConquestService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Badge, Card, CheckboxField, PageHeader, ProgressBar, SelectField, TextInput } from '../shared/ui';

const INITIAL_FILTERS: JapanConquestFilters = {
  region: 'all', status: 'all', favoriteOnly: false, query: '',
};

export function JapanConquestPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<JapanConquestFilters>(INITIAL_FILTERS);
  const [selectedCode, setSelectedCode] = useState<string>();
  const { data, error, loading } = useAsyncData(() => getJapanConquestData(), [reloadKey]);
  const filteredViews = useMemo(() => (data ? filterPrefectureViews(data.allViews, filters) : []), [data, filters]);
  const selectedView = data?.allViews.find((view) => view.master.code === selectedCode);

  return (
    <>
      <PageHeader
        title="日本制覇マップ"
        description="都道府県を選んで、旅の到達記録を残します。"
        actions={data && <Badge variant="primary">訪問済み {data.summary.visitedCount} / 47</Badge>}
      />

      {loading && <LoadingState variant="skeleton" message="日本地図を読み込み中..." />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="map-page">
          <section className="map-progress" aria-labelledby="map-progress-title">
            <div className="map-progress__head">
              <div><span>訪問制覇率</span><strong id="map-progress-title">{data.summary.visitRate.toFixed(1)}%</strong></div>
              <p>{data.summary.visitedCount}都道府県を訪問済み・未訪問 {data.summary.unvisitedCount}</p>
            </div>
            <ProgressBar
              label="47都道府県の訪問制覇率"
              value={data.summary.visitedCount}
              max={47}
              valueText={`${data.summary.visitRate.toFixed(1)}%`}
            />
            <div className="map-progress__details">
              <span>宿泊 {data.summary.stayedCount}</span>
              <span>居住 {data.summary.livedCount}</span>
              <span>到達 {data.summary.reachedCount}</span>
            </div>
          </section>

          <div className="map-primary-layout">
            <Card className="map-card" title="日本地図" description="都道府県をタップすると、地図の下に詳細が表示されます。">
              <JapanGeoMap views={data.allViews} selectedCode={selectedCode} onSelect={setSelectedCode} />
              <MapLegend />
            </Card>
            <PrefectureDetailPanel view={selectedView} onSaved={() => setReloadKey((value) => value + 1)} />
          </div>

          <Card title="都道府県を探す" description="地方・状態・名前から一覧を絞り込めます。">
            <div className="filter-grid map-filter-grid">
              <SelectField
                label="地方"
                value={filters.region}
                onChange={(event) => setFilters({ ...filters, region: event.target.value as JapanRegion | 'all' })}
              >
                <option value="all">すべて</option>
                {Object.entries(REGION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
              <SelectField
                label="状態"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value as PrefectureVisitStatus | 'all' })}
              >
                <option value="all">すべて</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
              <TextInput
                label="検索"
                value={filters.query}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                placeholder="都道府県名"
                autoComplete="off"
              />
              <CheckboxField
                label="お気に入りのみ"
                checked={filters.favoriteOnly}
                onChange={(event) => setFilters({ ...filters, favoriteOnly: event.target.checked })}
              />
            </div>
          </Card>

          <section className="map-prefecture-section" aria-labelledby="prefecture-list-title">
            <div className="section-head">
              <h2 id="prefecture-list-title">都道府県一覧</h2>
              <span className="muted">{filteredViews.length}件</span>
            </div>
            {filteredViews.length === 0 ? (
              <EmptyState title="条件に合う都道府県はありません" description="絞り込み条件を変更してください。" />
            ) : (
              <div className="prefecture-list map-prefecture-list">
                {filteredViews.map((view) => (
                  <button
                    type="button"
                    key={view.master.code}
                    className={`prefecture-row ${selectedCode === view.master.code ? 'selected' : ''}`}
                    aria-pressed={selectedCode === view.master.code}
                    onClick={() => setSelectedCode(view.master.code)}
                  >
                    <div>
                      <strong>{view.master.nameJa}</strong>
                      <div className="list-item__meta">{REGION_LABELS[view.master.region]} / {view.master.capital}</div>
                    </div>
                    <div className="prefecture-row__right">
                      <span className={`status-badge status-${view.visit.status}`}>{STATUS_LABELS[view.visit.status]}</span>
                      <span className="list-item__meta">初回 {view.visit.firstVisitedAt || '-'} / {view.visit.visitCount}回</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function MapLegend() {
  return (
    <div className="map-legend" aria-label="訪問状態の凡例">
      {(Object.keys(STATUS_LABELS) as PrefectureVisitStatus[]).map((status) => (
        <span key={status} className="legend-item">
          <span className={`legend-swatch status-${status}`} aria-hidden="true" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      ))}
      <span className="legend-item"><span className="legend-swatch legend-swatch--selected" aria-hidden="true" /><span>選択中</span></span>
    </div>
  );
}
