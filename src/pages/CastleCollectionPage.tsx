import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CastleVisitSummary } from '../domain/models/castle';
import {
  CASTLE_SERIES_LABELS,
  CASTLE_STATUS_LABELS,
  REGION_LABELS,
  getDefaultCastleFilter,
} from '../features/castles/castleUi';
import {
  getCastleCollectionView,
  listCastleRelatedTrips,
  updateCastleRecord,
  type CastleCollectionView,
  type CastleRelatedTrip,
} from '../features/castles/castleService';
import type { CastleFilter, CastleRecordInput } from '../features/castles/castleLogic';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { formatDateRange } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';

const ACQUISITION_LABELS: Record<CastleVisitSummary['stampStatus'], string> = {
  unknown: '未確認',
  not_acquired: '未取得',
  acquired: '取得済み',
};

export function CastleCollectionPage() {
  const [searchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<CastleFilter>(() => ({
    ...getDefaultCastleFilter(),
    prefectureCode: searchParams.get('prefecture') ?? 'all',
  }));
  const { data, error, loading } = useAsyncData(() => getCastleCollectionView(filter), [filter, reloadKey]);
  const [selectedCastleId, setSelectedCastleId] = useState<string>();
  const selectedRow = data?.filteredRows.find((row) => row.castle.id === selectedCastleId) ?? data?.filteredRows[0];

  useEffect(() => {
    if (!selectedCastleId && data?.filteredRows[0]) {
      setSelectedCastleId(data.filteredRows[0].castle.id);
    }
  }, [data, selectedCastleId]);

  return (
    <>
      <section className="page-heading">
        <div className="page-heading__row">
          <div>
            <h1>城コレクション</h1>
            <p>日本100名城・続日本100名城の訪問、スタンプ、御城印を管理します。</p>
          </div>
          <Link className="button" to="/collections">通常コレクション</Link>
        </div>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="grid">
          <CastleSummary view={data} />
          <p className="status-banner">
            この画面は個人の訪問記録です。日本城郭協会等による公式認定・公式証明ではありません。
          </p>
          <CastleMap rows={data.rows} selectedCastleId={selectedRow?.castle.id} onSelect={setSelectedCastleId} />
          <CastleFilters view={data} filter={filter} onChange={setFilter} />
          <div className="castle-layout">
            <CastleList
              rows={data.filteredRows}
              selectedCastleId={selectedRow?.castle.id}
              onSelect={(castleId) => setSelectedCastleId(castleId)}
            />
            {selectedRow ? (
              <CastleDetailPanel
                key={selectedRow.castle.id}
                row={selectedRow}
                onSaved={() => setReloadKey((value) => value + 1)}
              />
            ) : (
              <EmptyState>条件に合う城がありません。</EmptyState>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CastleMap({
  rows,
  selectedCastleId,
  onSelect,
}: {
  rows: CastleCollectionView['rows'];
  selectedCastleId?: string;
  onSelect: (castleId: string) => void;
}) {
  const plottedRows = rows.filter((row) => typeof row.castle.latitude === 'number' && typeof row.castle.longitude === 'number');
  return (
    <section className="card map-card">
      <div className="section-head">
        <h2>城マップ</h2>
        <span className="muted">{plottedRows.length} / 200城</span>
      </div>
      {plottedRows.length === 0 ? (
        <EmptyState>検証済み座標がまだありません。座標出典を追加するとここに表示されます。</EmptyState>
      ) : (
        <svg className="castle-map" viewBox="0 0 320 360" role="img" aria-label="城の位置">
          <rect x="0" y="0" width="320" height="360" rx="8" fill="#eef6f6" />
          {plottedRows.map(({ castle, summary }) => {
            const x = ((Number(castle.longitude) - 122) / (154 - 122)) * 300 + 10;
            const y = (1 - ((Number(castle.latitude) - 20) / (46 - 20))) * 340 + 10;
            return (
              <g
                key={castle.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(castle.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(castle.id);
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={selectedCastleId === castle.id ? 7 : 5}
                  className={`castle-map-point castle-status-${summary.status}`}
                >
                  <title>{castle.nameJa}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

function CastleSummary({ view }: { view: CastleCollectionView }) {
  return (
    <section className="grid summary-grid">
      <div className="card">
        <h2>登城済み</h2>
        <div className="stat-value">{view.stats.visitedCount}</div>
        <div className="muted">{view.stats.visitedRate.toFixed(1)}% / 200城</div>
      </div>
      <div className="card">
        <h2>日本100名城</h2>
        <div className="stat-value">{view.stats.japanese100VisitedCount}</div>
        <div className="muted">{view.stats.japanese100VisitedRate.toFixed(1)}% / 100城</div>
      </div>
      <div className="card">
        <h2>続100名城</h2>
        <div className="stat-value">{view.stats.continued100VisitedCount}</div>
        <div className="muted">{view.stats.continued100VisitedRate.toFixed(1)}% / 100城</div>
      </div>
      <div className="card">
        <h2>スタンプ</h2>
        <div className="stat-value">{view.stats.stampCount}</div>
        <div className="muted">御城印 {view.stats.goshuinCount} / お気に入り {view.stats.favoriteCount}</div>
      </div>
    </section>
  );
}

function CastleFilters({
  view,
  filter,
  onChange,
}: {
  view: CastleCollectionView;
  filter: CastleFilter;
  onChange: (filter: CastleFilter) => void;
}) {
  const regions = useMemo(() => Array.from(new Set(view.castles.map((castle) => castle.region))), [view.castles]);
  const prefectures = useMemo(
    () => Array.from(new Map(view.castles.map((castle) => [castle.prefectureCode, castle.prefectureName])).entries()),
    [view.castles],
  );

  return (
    <section className="card">
      <div className="filter-grid castle-filter-grid">
        <label className="field">
          <span>検索</span>
          <input
            value={filter.query}
            placeholder="城名・所在地"
            onChange={(event) => onChange({ ...filter, query: event.target.value })}
          />
        </label>
        <label className="field">
          <span>地方</span>
          <select value={filter.region} onChange={(event) => onChange({ ...filter, region: event.target.value })}>
            <option value="all">すべて</option>
            {regions.map((region) => <option key={region} value={region}>{REGION_LABELS[region] ?? region}</option>)}
          </select>
        </label>
        <label className="field">
          <span>都道府県</span>
          <select value={filter.prefectureCode} onChange={(event) => onChange({ ...filter, prefectureCode: event.target.value })}>
            <option value="all">すべて</option>
            {prefectures.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>シリーズ</span>
          <select value={filter.series} onChange={(event) => onChange({ ...filter, series: event.target.value as CastleFilter['series'] })}>
            <option value="all">すべて</option>
            {Object.entries(CASTLE_SERIES_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>状態</span>
          <select value={filter.status} onChange={(event) => onChange({ ...filter, status: event.target.value as CastleFilter['status'] })}>
            <option value="all">すべて</option>
            {Object.entries(CASTLE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>スタンプ</span>
          <select value={filter.stampStatus} onChange={(event) => onChange({ ...filter, stampStatus: event.target.value as CastleFilter['stampStatus'] })}>
            <option value="all">すべて</option>
            {Object.entries(ACQUISITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>並び順</span>
          <select value={filter.sort} onChange={(event) => onChange({ ...filter, sort: event.target.value as CastleFilter['sort'] })}>
            <option value="official">公式番号順</option>
            <option value="name">名前順</option>
            <option value="recent">最近訪問順</option>
            <option value="visitCount">訪問回数順</option>
          </select>
        </label>
        <label className="checkbox-field filter-checkbox">
          <input
            type="checkbox"
            checked={filter.favoriteOnly}
            onChange={(event) => onChange({ ...filter, favoriteOnly: event.target.checked })}
          />
          お気に入りのみ
        </label>
      </div>
    </section>
  );
}

function CastleList({
  rows,
  selectedCastleId,
  onSelect,
}: {
  rows: CastleCollectionView['filteredRows'];
  selectedCastleId?: string;
  onSelect: (castleId: string) => void;
}) {
  if (rows.length === 0) return <EmptyState>条件に合う城がありません。</EmptyState>;
  return (
    <section className="card castle-list-card">
      <div className="section-head">
        <h2>城一覧</h2>
        <span className="muted">{rows.length}件</span>
      </div>
      <div className="prefecture-list">
        {rows.map(({ castle, summary }) => (
          <button
            className={selectedCastleId === castle.id ? 'prefecture-row selected' : 'prefecture-row'}
            type="button"
            key={castle.id}
            onClick={() => onSelect(castle.id)}
          >
            <div>
              <p className="list-item__title">{castle.sourceNumber}. {castle.nameJa}</p>
              <div className="list-item__meta">
                {CASTLE_SERIES_LABELS[castle.series]} / {castle.prefectureName}{castle.municipality}
              </div>
            </div>
            <div className="prefecture-row__right">
              <span className={`status-badge castle-status-${summary.status}`}>{CASTLE_STATUS_LABELS[summary.status]}</span>
              <span className="list-item__meta">{summary.visitCount}回</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function CastleDetailPanel({
  row,
  onSaved,
}: {
  row: CastleCollectionView['rows'][number];
  onSaved: () => void;
}) {
  const [input, setInput] = useState<CastleRecordInput>(() => toInput(row.summary));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: relatedTrips } = useAsyncData<CastleRelatedTrip[]>(
    () => listCastleRelatedTrips(row.castle.id),
    [row.castle.id],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await updateCastleRecord(row.castle.id, input);
      onSaved();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card detail-panel">
      <div className="section-head">
        <div>
          <h2>{row.castle.nameJa}</h2>
          <p className="muted">
            {row.castle.sourceNumber}. {CASTLE_SERIES_LABELS[row.castle.series]} / {row.castle.prefectureName}{row.castle.municipality}
          </p>
        </div>
        <span className={`status-badge castle-status-${input.status}`}>{CASTLE_STATUS_LABELS[input.status]}</span>
      </div>

      {formError && <div className="form-errors">{formError}</div>}

      <form className="form form--compact" onSubmit={handleSubmit}>
        <label className="field">
          <span>訪問状態</span>
          <select value={input.status} onChange={(event) => setInput({ ...input, status: event.target.value as CastleRecordInput['status'] })}>
            {Object.entries(CASTLE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            <span>初回訪問日</span>
            <input type="date" value={input.firstVisitedAt} onChange={(event) => setInput({ ...input, firstVisitedAt: event.target.value })} />
          </label>
          <label className="field">
            <span>最終訪問日</span>
            <input type="date" value={input.lastVisitedAt} onChange={(event) => setInput({ ...input, lastVisitedAt: event.target.value })} />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>訪問回数</span>
            <input type="number" min="0" value={input.visitCount} onChange={(event) => setInput({ ...input, visitCount: Number(event.target.value) })} />
          </label>
          <label className="field">
            <span>評価</span>
            <select value={input.rating} onChange={(event) => setInput({ ...input, rating: event.target.value })}>
              <option value="">未評価</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>スタンプ</span>
            <select value={input.stampStatus} onChange={(event) => setInput({ ...input, stampStatus: event.target.value as CastleRecordInput['stampStatus'] })}>
              {Object.entries(ACQUISITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>スタンプ取得日</span>
            <input type="date" value={input.stampAcquiredAt} onChange={(event) => setInput({ ...input, stampAcquiredAt: event.target.value })} />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>御城印</span>
            <select value={input.goshuinStatus} onChange={(event) => setInput({ ...input, goshuinStatus: event.target.value as CastleRecordInput['goshuinStatus'] })}>
              {Object.entries(ACQUISITION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>御城印取得日</span>
            <input type="date" value={input.goshuinAcquiredAt} onChange={(event) => setInput({ ...input, goshuinAcquiredAt: event.target.value })} />
          </label>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" checked={input.isFavorite} onChange={(event) => setInput({ ...input, isFavorite: event.target.checked })} />
          お気に入り
        </label>
        <label className="field">
          <span>メモ</span>
          <textarea rows={4} value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} />
        </label>
        <CastleRelatedTripList relatedTrips={relatedTrips ?? []} />
        <div className="status-banner">
          <strong>公式スタンプ・認定</strong>
          <div>
            このアプリのスタンプ/御城印記録は個人メモです。公式スタンプ帳、認定証、公式ロゴ、スタンプ画像とは連携していません。
          </div>
        </div>
        {row.castle.officialReferenceUrl && (
          <a className="button" href={row.castle.officialReferenceUrl} target="_blank" rel="noreferrer">
            参照ページを開く
          </a>
        )}
        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? '保存中' : '保存'}
          </button>
        </div>
      </form>
    </section>
  );
}

function CastleRelatedTripList({ relatedTrips }: { relatedTrips: CastleRelatedTrip[] }) {
  return (
    <div className="status-banner">
      <strong>関連する旅行記録</strong>
      {relatedTrips.length === 0 ? (
        <div>旅行の訪問場所でこの城を選ぶと、ここに表示されます。</div>
      ) : (
        <div className="castle-related-trips">
          {relatedTrips.map((trip) => (
            <Link key={trip.tripId} to={`/trips/${trip.tripId}`}>
              {trip.title} / {formatDateRange(trip.startDate, trip.endDate)}
              {trip.placeNames.length > 0 ? ` / ${trip.placeNames.join(', ')}` : ''}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function toInput(summary: CastleVisitSummary): CastleRecordInput {
  return {
    status: summary.status,
    firstVisitedAt: summary.firstVisitedAt ?? '',
    lastVisitedAt: summary.lastVisitedAt ?? '',
    visitCount: summary.visitCount,
    stampStatus: summary.stampStatus,
    stampAcquiredAt: summary.stampAcquiredAt ?? '',
    goshuinStatus: summary.goshuinStatus,
    goshuinAcquiredAt: summary.goshuinAcquiredAt ?? '',
    rating: summary.rating ? String(summary.rating) : '',
    isFavorite: summary.isFavorite,
    note: summary.note ?? '',
  };
}
