import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { MediaAsset } from '../domain/models/scrapbook';
import type { TimelineConfidence, TimelineEvent } from '../domain/models/timeMachine';
import { createMediaObjectUrl } from '../features/scrapbooks/scrapbookService';
import {
  createManualTimelineEntry,
  getDefaultTimeMachineQuery,
  getLastYearDate,
  getTimeMachineResult,
  shiftDate,
  type TimeMachineManualInput,
  type TimeMachineQuery,
} from '../features/timeMachine/timeMachineService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { todayDateInputValue } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';

const CONFIDENCE_LABELS: Record<TimelineConfidence, string> = {
  exact: '正確な記録',
  high: 'かなり確か',
  medium: '推定',
  low: 'おおよその場所',
  unknown: '記録不足',
};

const INFERENCE_MODE_LABELS = {
  exact_match: '指定時刻付近の記録',
  between_same_place: '前後の記録が同じ場所',
  moving_between_places: '移動中の可能性',
  candidate_list: 'この日の候補地',
  insufficient_data: '記録不足',
};

export function TimeMachinePage() {
  const [query, setQuery] = useState<TimeMachineQuery>(getDefaultTimeMachineQuery);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const { data, error, loading } = useAsyncData(() => getTimeMachineResult(query), [query, reloadKey]);
  const selectedEvent = data?.events.find((event) => event.id === selectedEventId);

  useEffect(() => {
    setSelectedEventId(undefined);
  }, [query.date, query.time]);

  function moveDate(days: number) {
    setMessage('');
    setQuery((current) => ({ ...current, date: shiftDate(current.date, days) }));
  }

  function moveLastYear() {
    const result = getLastYearDate(query.date);
    setMessage(result.adjustedReason ?? '');
    setQuery((current) => ({ ...current, date: result.date }));
  }

  return (
    <>
      <section className="page-heading time-machine-hero">
        <div className="page-heading__row">
          <div>
            <h1>タイムマシン</h1>
            <p>あの時どこにいた？旅行、写真、訪問場所、スクラップブック、達成記録を日付でたどります。</p>
          </div>
          <Link className="button" to="/">ホーム</Link>
        </div>
      </section>

      <section className="card time-machine-controls">
        <form className="form form--compact" onSubmit={(event) => event.preventDefault()}>
          <div className="form-grid">
            <label className="field">
              <span>日付</span>
              <input type="date" value={query.date} onChange={(event) => setQuery({ ...query, date: event.target.value })} />
            </label>
            <label className="field">
              <span>時刻 任意</span>
              <input type="time" value={query.time ?? ''} onChange={(event) => setQuery({ ...query, time: event.target.value || undefined })} />
            </label>
          </div>
          <div className="inline-actions">
            <button className="button" type="button" onClick={() => moveDate(-1)}>前日</button>
            <button className="button" type="button" onClick={() => moveDate(1)}>翌日</button>
            <button className="button" type="button" onClick={moveLastYear}>1年前へ</button>
            <button className="button" type="button" onClick={() => {
              const result = getLastYearDate(todayDateInputValue());
              setMessage(result.adjustedReason ?? '');
              setQuery({ ...query, date: result.date });
            }}>去年の今日</button>
            <button className="button" type="button" onClick={() => {
              setMessage('');
              setQuery({ ...query, date: todayDateInputValue(), time: undefined });
            }}>今日へ戻る</button>
          </div>
          <div className="inline-actions">
            <label className="checkbox-field filter-checkbox">
              <input type="checkbox" checked={query.includeEstimated ?? true} onChange={(event) => setQuery({ ...query, includeEstimated: event.target.checked })} />
              推定を表示
            </label>
            <label className="checkbox-field filter-checkbox">
              <input type="checkbox" checked={query.includeRpg ?? true} onChange={(event) => setQuery({ ...query, includeRpg: event.target.checked })} />
              RPGを表示
            </label>
            <label className="checkbox-field filter-checkbox">
              <input type="checkbox" checked={query.includeCollections ?? true} onChange={(event) => setQuery({ ...query, includeCollections: event.target.checked })} />
              城・収集を表示
            </label>
          </div>
        </form>
        {message && <p className="muted">{message}</p>}
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="grid time-machine-grid">
          <section className="card time-machine-now">
            <h2>この時刻にいた可能性が高い場所</h2>
            {data.locationInference.primaryCandidate ? (
              <div>
                <p className="time-machine-place">{data.locationInference.primaryCandidate.locationName}</p>
                <span className={`confidence-badge confidence-${data.locationInference.confidence}`}>
                  {CONFIDENCE_LABELS[data.locationInference.confidence]}
                </span>
                <span className="inference-mode">{INFERENCE_MODE_LABELS[data.locationInference.mode]}</span>
                <ul className="muted-list">
                  {data.locationInference.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                {data.locationInference.beforeEvent && <p className="muted">前の地点: {data.locationInference.beforeEvent.title}</p>}
                {data.locationInference.afterEvent && <p className="muted">次の地点: {data.locationInference.afterEvent.title}</p>}
                {data.locationInference.conflictingSources.length > 0 && <p className="muted">前後の候補地が異なるため、移動中または記録誤差の可能性があります。</p>}
                {data.locationInference.candidateLocations.length > 1 && (
                  <div className="candidate-list">
                    <h3>ほかの候補</h3>
                    {data.locationInference.candidateLocations.slice(1, 5).map((candidate) => (
                      <div className="candidate-row" key={`${candidate.eventId}-${candidate.locationName}`}>
                        <div>
                          <strong>{candidate.locationName}</strong>
                          <div className="list-item__meta">
                            根拠 {candidate.supportingEventIds.length}件
                            {candidate.distanceMinutes !== undefined ? ` / 指定時刻から約${candidate.distanceMinutes}分` : ''}
                          </div>
                        </div>
                        <span className={`confidence-badge confidence-${candidate.confidence}`}>{CONFIDENCE_LABELS[candidate.confidence]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState>この日の場所はまだ分かりません。</EmptyState>
            )}
          </section>

          <section className="card">
            <h2>地図</h2>
            <TimelineMap
              events={data.mapPoints}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
            <p className="muted">線はGPS軌跡ではなく、記録順を結んだ推定表示です。</p>
            {selectedEvent && <SelectedEventPanel event={selectedEvent} />}
            <MaplessEvents events={data.events.filter((event) => !data.mapPoints.some((point) => point.id === event.id))} onSelectEvent={setSelectedEventId} />
          </section>

          <section className="card">
            <h2>関連する旅行</h2>
            {data.relatedTrips.length === 0 ? (
              <EmptyState>この日に重なる旅行はありません。</EmptyState>
            ) : (
              <div className="list">
                {data.relatedTrips.map((trip) => (
                  <Link className="list-item" key={trip.id} to={`/trips/${trip.id}`}>
                    <div>
                      <p className="list-item__title">{trip.title}</p>
                      <div className="list-item__meta">{trip.dayCount}日間のうち{trip.dayNumber}日目</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>写真</h2>
            <PhotoStrip photos={data.photos} />
          </section>

          <section className="card">
            <h2>スクラップブック</h2>
            {data.relatedScrapbooks.length === 0 ? (
              <EmptyState>関連するスクラップブックはありません。</EmptyState>
            ) : (
              <div className="list">
                {data.relatedScrapbooks.map((scrapbook) => (
                  <Link className="list-item" key={scrapbook.id} to={`/trips/${scrapbook.tripId}/scrapbook`}>
                    <div>
                      <p className="list-item__title">{scrapbook.title}</p>
                      <div className="list-item__meta">{scrapbook.pages.length}ページが関連</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card time-machine-wide">
            <h2>タイムライン</h2>
            {data.empty ? (
              <EmptyState>この日の記録はまだありません。下のフォームから、いた場所やメモを補完できます。</EmptyState>
            ) : (
              <TimelineList events={data.events} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} />
            )}
          </section>

          <section className="card time-machine-wide">
            <h2>過去データを補完</h2>
            <ManualEntryForm date={query.date} onSaved={() => setReloadKey((value) => value + 1)} />
          </section>
        </div>
      )}
    </>
  );
}

function TimelineList({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: TimelineEvent[];
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const timed = events.filter((event) => event.startAt && event.timePrecision !== 'day');
  const untimed = events.filter((event) => !event.startAt || event.timePrecision === 'day');
  return (
    <div className="timeline-list">
      {timed.map((event) => <TimelineRow key={event.id} event={event} selected={event.id === selectedEventId} onSelectEvent={onSelectEvent} />)}
      {untimed.length > 0 && (
        <div className="timeline-untimed">
          <h3>時刻不明・この日の記録</h3>
          {untimed.map((event) => <TimelineRow key={event.id} event={event} selected={event.id === selectedEventId} onSelectEvent={onSelectEvent} />)}
        </div>
      )}
    </div>
  );
}

function TimelineRow({
  event,
  selected,
  onSelectEvent,
}: {
  event: TimelineEvent;
  selected: boolean;
  onSelectEvent: (eventId: string) => void;
}) {
  const time = event.startAt && event.timePrecision !== 'day'
    ? new Date(event.startAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '時刻不明';
  return (
    <article className={`timeline-row ${selected ? 'selected' : ''}`} id={`timeline-event-${event.id}`}>
      <div className="timeline-row__time">{time}</div>
      <div className="timeline-row__body">
        <div className="timeline-row__head">
          <strong>{event.title}</strong>
          <span className={`confidence-badge confidence-${event.confidence}`}>{CONFIDENCE_LABELS[event.confidence]}</span>
        </div>
        {event.description && <p>{event.description}</p>}
        <p className="muted">{event.confidenceReason}</p>
        <div className="inline-actions timeline-row__actions">
          <button className="button" type="button" onClick={() => onSelectEvent(event.id)}>地図で見る</button>
          {event.detailPath && <Link className="button" to={event.detailPath}>詳細</Link>}
        </div>
      </div>
    </article>
  );
}

function TimelineMap({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: TimelineEvent[];
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const points = useMemo(() => {
    if (events.length === 0) return [];
    const lats = events.map((event) => event.latitude ?? 0);
    const lngs = events.map((event) => event.longitude ?? 0);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return events.map((event, index) => ({
      event,
      index,
      x: scale(event.longitude ?? minLng, minLng, maxLng),
      y: 100 - scale(event.latitude ?? minLat, minLat, maxLat),
    }));
  }, [events]);
  if (points.length === 0) return <EmptyState>緯度経度付きの記録はありません。地図以外の一覧で確認できます。</EmptyState>;
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <div className="time-map" role="img" aria-label="指定日の地点を時系列番号で表示した簡易地図">
      {points.length > 1 && (
        <svg className="time-map__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={polylinePoints} />
        </svg>
      )}
      {points.map((point) => (
        <button
          key={point.event.id}
          className={`time-map__point ${point.event.id === selectedEventId ? 'selected' : ''}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          title={point.event.title}
          type="button"
          onClick={() => onSelectEvent(point.event.id)}
          aria-label={`${point.index + 1}番目の地点 ${point.event.title}`}
        >
          {point.index + 1}
        </button>
      ))}
    </div>
  );
}

function SelectedEventPanel({ event }: { event: TimelineEvent }) {
  return (
    <div className="selected-event-panel">
      <h3>選択中の地点</h3>
      <p className="list-item__title">{event.title}</p>
      <p className="muted">{event.locationName || '場所名なし'} / {CONFIDENCE_LABELS[event.confidence]}</p>
      {event.startAt && <p className="muted">{new Date(event.startAt).toLocaleString('ja-JP')}</p>}
      {event.description && <p>{event.description}</p>}
      <div className="inline-actions">
        <a className="button" href={`#timeline-event-${event.id}`}>タイムラインへ</a>
        {event.detailPath && <Link className="button" to={event.detailPath}>関連詳細</Link>}
      </div>
    </div>
  );
}

function MaplessEvents({
  events,
  onSelectEvent,
}: {
  events: TimelineEvent[];
  onSelectEvent: (eventId: string) => void;
}) {
  if (events.length === 0) return null;
  return (
    <div className="mapless-events">
      <h3>地図外の記録</h3>
      <div className="mapless-events__list">
        {events.slice(0, 6).map((event) => (
          <button key={event.id} className="mapless-event" type="button" onClick={() => onSelectEvent(event.id)}>
            <span>{event.title}</span>
            <small>{CONFIDENCE_LABELS[event.confidence]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoStrip({ photos }: { photos: MediaAsset[] }) {
  if (photos.length === 0) return <EmptyState>この時間帯の写真はありません。</EmptyState>;
  return (
    <div className="time-photo-strip">
      {photos.map((photo) => <TimePhoto key={photo.id} asset={photo} />)}
    </div>
  );
}

function TimePhoto({ asset }: { asset: MediaAsset }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    void createMediaObjectUrl(asset, 'thumbnail').then((nextUrl) => {
      if (cancelled) {
        if (nextUrl) URL.revokeObjectURL(nextUrl);
        return;
      }
      objectUrl = nextUrl;
      setUrl(nextUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset]);
  return (
    <figure className="time-photo">
      {url ? <img src={url} alt={asset.originalFileName || 'タイムマシン写真'} loading="lazy" /> : <div className="empty-state">写真を読み込み中...</div>}
      <figcaption>{asset.takenAt ? new Date(asset.takenAt).toLocaleString('ja-JP') : '撮影日時なし'}</figcaption>
    </figure>
  );
}

function ManualEntryForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [input, setInput] = useState<TimeMachineManualInput>({
    date,
    locationName: '',
    note: '',
    confidence: 'medium',
  });
  const [error, setError] = useState('');
  useEffect(() => setInput((current) => ({ ...current, date })), [date]);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await createManualTimelineEntry(input);
      setInput({ date, locationName: '', note: '', confidence: 'medium' });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    }
  }
  return (
    <form className="form form--compact" onSubmit={handleSubmit}>
      {error && <div className="form-errors">{error}</div>}
      <div className="form-grid">
        <label className="field">
          <span>時刻 任意</span>
          <input type="time" value={input.time ?? ''} onChange={(event) => setInput({ ...input, time: event.target.value || undefined })} />
        </label>
        <label className="field">
          <span>確度</span>
          <select value={input.confidence} onChange={(event) => setInput({ ...input, confidence: event.target.value as TimelineConfidence })}>
            <option value="high">かなり確か</option>
            <option value="medium">推定</option>
            <option value="low">おおよその場所</option>
            <option value="unknown">記録不足</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>いた場所</span>
        <input value={input.locationName} onChange={(event) => setInput({ ...input, locationName: event.target.value })} />
      </label>
      <label className="field">
        <span>メモ</span>
        <textarea rows={3} value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} />
      </label>
      <button className="button button--primary" type="submit">補完記録を保存</button>
    </form>
  );
}

function scale(value: number, min: number, max: number): number {
  if (min === max) return 50;
  return Math.min(94, Math.max(6, ((value - min) / (max - min)) * 88 + 6));
}
