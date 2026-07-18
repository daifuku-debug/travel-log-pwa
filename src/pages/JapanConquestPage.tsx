import { useMemo, useState } from 'react';
import { JapanGeoMap } from '../features/japanConquest/components/JapanGeoMap';
import { PrefectureDetailPanel } from '../features/japanConquest/components/PrefectureDetailPanel';
import {
  REGION_LABELS,
  STATUS_LABELS,
  filterPrefectureViews,
  type JapanConquestFilters,
} from '../features/japanConquest/japanConquestLogic';
import { getJapanConquestData } from '../features/japanConquest/japanConquestService';
import type { JapanRegion, PrefectureVisitStatus } from '../domain/models/japanConquest';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

const INITIAL_FILTERS: JapanConquestFilters = {
  region: 'all',
  status: 'all',
  favoriteOnly: false,
  query: '',
};

export function JapanConquestPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<JapanConquestFilters>(INITIAL_FILTERS);
  const [selectedCode, setSelectedCode] = useState<string | undefined>('01');
  const { data, error, loading } = useAsyncData(() => getJapanConquestData(), [reloadKey]);
  const filteredViews = useMemo(
    () => (data ? filterPrefectureViews(data.allViews, filters) : []),
    [data, filters],
  );
  const selectedView = data?.allViews.find((view) => view.master.code === selectedCode);

  return (
    <>
      <section className="page-heading">
        <h1>日本制覇マップ</h1>
        <p>
          訪問済み {data?.summary.visitedCount ?? 0} / 47・制覇率 {data?.summary.visitRate.toFixed(1) ?? '0.0'}%
        </p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="grid">
          <div className="grid grid--two summary-grid">
            <SummaryCard label="訪問済み" value={`${data.summary.visitedCount}`} sub={`${data.summary.visitRate.toFixed(1)}%`} />
            <SummaryCard label="宿泊済み" value={`${data.summary.stayedCount}`} sub={`${data.summary.stayRate.toFixed(1)}%`} />
            <SummaryCard label="居住経験" value={`${data.summary.livedCount}`} sub={`${data.summary.livedRate.toFixed(1)}%`} />
            <SummaryCard label="通過のみ" value={`${data.summary.passedOnlyCount}`} sub={`到達率 ${data.summary.reachedRate.toFixed(1)}%`} />
            <SummaryCard label="未訪問" value={`${data.summary.unvisitedCount}`} sub="これから" />
          </div>

          <section className="card map-card">
            <div className="section-head">
              <h2>地図</h2>
              <span className="muted">タップで詳細を編集</span>
            </div>
            <JapanGeoMap views={data.allViews} selectedCode={selectedCode} onSelect={setSelectedCode} />
            <Legend />
          </section>

          <PrefectureDetailPanel
            view={selectedView}
            onSaved={() => setReloadKey((value) => value + 1)}
          />

          <section className="card">
            <h2>絞り込み</h2>
            <div className="filter-grid">
              <label className="field">
                <span>地方</span>
                <select
                  value={filters.region}
                  onChange={(event) => setFilters({ ...filters, region: event.target.value as JapanConquestFilters['region'] })}
                >
                  <option value="all">すべて</option>
                  {Object.entries(REGION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>状態</span>
                <select
                  value={filters.status}
                  onChange={(event) => setFilters({ ...filters, status: event.target.value as JapanConquestFilters['status'] })}
                >
                  <option value="all">すべて</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>検索</span>
                <input
                  value={filters.query}
                  onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                  placeholder="都道府県名"
                />
              </label>
              <label className="checkbox-field filter-checkbox">
                <input
                  type="checkbox"
                  checked={filters.favoriteOnly}
                  onChange={(event) => setFilters({ ...filters, favoriteOnly: event.target.checked })}
                />
                お気に入りのみ
              </label>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>都道府県一覧</h2>
              <span className="muted">{filteredViews.length}件</span>
            </div>
            <div className="prefecture-list">
              {filteredViews.length === 0 ? (
                <div className="empty-state">条件に合う都道府県はありません。</div>
              ) : (
                filteredViews.map((view) => (
                  <button
                    type="button"
                    key={view.master.code}
                    className={`prefecture-row ${selectedCode === view.master.code ? 'selected' : ''}`}
                    onClick={() => setSelectedCode(view.master.code)}
                  >
                    <div>
                      <strong>{view.master.nameJa}</strong>
                      <div className="list-item__meta">{REGION_LABELS[view.master.region]} / {view.master.capital}</div>
                    </div>
                    <div className="prefecture-row__right">
                      <span className={`status-badge status-${view.visit.status}`}>{STATUS_LABELS[view.visit.status]}</span>
                      <span className="list-item__meta">
                        初回 {view.visit.firstVisitedAt || '-'} / {view.visit.visitCount}回
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <h2>{label}</h2>
      <div className="stat-value">{value}</div>
      <div className="muted">{sub}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      {(Object.keys(STATUS_LABELS) as PrefectureVisitStatus[]).map((status) => (
        <span key={status} className="legend-item">
          <span className={`legend-swatch status-${status}`} />
          {STATUS_LABELS[status]}
        </span>
      ))}
    </div>
  );
}
