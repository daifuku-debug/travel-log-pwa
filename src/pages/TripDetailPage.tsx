import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PlaceVisit, Trip, TripTransportLeg } from '../domain/models/trip';
import { PlaceVisitForm } from '../features/trips/components/PlaceVisitForm';
import { TransportLegForm } from '../features/trips/components/TransportLegForm';
import { TripJournalTimeline } from '../features/trips/components/TripJournalTimeline';
import { TripJournalVisual } from '../features/trips/components/TripJournalVisual';
import {
  createPlaceVisit,
  createTripTransportLeg,
  deletePlaceVisit,
  deleteTrip,
  deleteTripTransportLeg,
  getTripDetail,
  updatePlaceVisit,
  updateTripTransportLeg,
  type TripDetail,
} from '../features/trips/tripService';
import { getTripDisplayStatus, getTripDisplayStatusLabel } from '../features/trips/tripUi';
import { useTripJournalMedia } from '../features/trips/useTripJournalMedia';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { formatCompactDateRange, isoDateTimeToDateInput } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Button, ConfirmDialog, InlineError, PageHeader } from '../shared/ui';

type PendingDelete =
  | { kind: 'trip'; label: string }
  | { kind: 'place'; id: string; label: string }
  | { kind: 'leg'; id: string; label: string };

export function TripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [editingPlace, setEditingPlace] = useState<PlaceVisit>();
  const [editingTransportLeg, setEditingTransportLeg] = useState<TripTransportLeg>();
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>();
  const [deleting, setDeleting] = useState(false);
  const media = useTripJournalMedia(tripId);
  const { data, error, loading } = useAsyncData(
    () => (tripId ? getTripDetail(tripId) : Promise.resolve(undefined)),
    [tripId, reloadKey],
  );

  async function runAction(action: () => Promise<void>, fallback: string) {
    setActionError('');
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : fallback);
    }
  }

  async function handleDeleteTrip() {
    if (!tripId) return;
    setActionError('');
    try {
      await deleteTrip(tripId);
      navigate('/trips');
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : '旅行の削除に失敗しました。');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    if (pendingDelete.kind === 'trip') {
      await handleDeleteTrip();
      setDeleting(false);
      return;
    }
    const target = pendingDelete;
    await runAction(
      () => target.kind === 'leg' ? deleteTripTransportLeg(target.id) : deletePlaceVisit(target.id),
      target.kind === 'leg' ? '移動区間の削除に失敗しました。' : '訪問場所の削除に失敗しました。',
    );
    setPendingDelete(undefined);
    setDeleting(false);
  }

  if (loading) return <JournalState title="旅行詳細" description="旅の記録を読み込んでいます。"><LoadingState variant="skeleton" message="旅行詳細を読み込み中..." /></JournalState>;
  if (error) return <JournalState title="旅行詳細" description="旅の記録を確認します。"><ErrorState error={error} /></JournalState>;
  if (!data) return (
    <JournalState title="旅行が見つかりません" description="削除されたか、URLが正しくない可能性があります。">
      <EmptyState action={<Button to="/trips">旅行一覧へ戻る</Button>} />
    </JournalState>
  );

  const { trip, places, transportLegs } = data;
  const placeNames = places.map((place) => place.name);
  const coverSource = media.coverSource;

  return (
    <article className="trip-journal">
      <TripJournalHero trip={trip} placeNames={placeNames} coverSource={coverSource} />
      <div className="trip-journal__surface">
        {actionError && <InlineError message={actionError} />}
        <TripSummary data={data} />

        <JournalSection id="trip-memory-title" eyebrow="Memories" title="旅の思い出" className="trip-journal-memory">
          <div className="trip-journal-memory__copy">
            <p>{trip.memo || media.highlights[0] || trip.purpose || 'この旅の思い出を、少しずつ残していきましょう。'}</p>
            {media.highlights.slice(trip.memo ? 0 : 1, 2).map((highlight) => <p key={highlight}>{highlight}</p>)}
          </div>
          {media.sources.length > 0 ? (
            <div className={`trip-journal-gallery trip-journal-gallery--${Math.min(media.sources.length, 4)}`}>
              {media.sources.slice(0, 4).map((source, index) => <img key={source} src={source} alt={`${trip.title}の思い出 ${index + 1}`} loading="lazy" />)}
            </div>
          ) : (
            <TripJournalVisual trip={trip} placeNames={placeNames} alt="" className="trip-journal-memory__fallback" />
          )}
          <Link className="trip-journal-text-link" to={`/trips/${trip.id}/scrapbook`}>スクラップブックを開く <span aria-hidden="true">→</span></Link>
        </JournalSection>

        <JournalSection id="trip-timeline-title" eyebrow="Story" title="旅のタイムライン">
          <TripJournalTimeline places={places} transportLegs={transportLegs} />
        </JournalSection>

        <JournalSection id="trip-route-title" eyebrow="Route" title="この日の軌跡">
          <JourneyTrail trip={trip} places={places} transportLegs={transportLegs} />
        </JournalSection>

        <JournalSection id="trip-achievement-title" eyebrow="Keepsakes" title="この旅で残したもの">
          <TripKeepsakes data={data} photoCount={media.photoCount} />
        </JournalSection>

        <TripJournalEditor
          data={data}
          tripId={tripId}
          editingPlace={editingPlace}
          editingTransportLeg={editingTransportLeg}
          setEditingPlace={setEditingPlace}
          setEditingTransportLeg={setEditingTransportLeg}
          setPendingDelete={setPendingDelete}
          runAction={runAction}
        />
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'trip' ? 'この旅行を削除しますか？' : 'この記録を削除しますか？'}
        description={pendingDelete?.kind === 'trip' ? `「${pendingDelete.label}」と紐づく記録も削除され、元に戻せません。` : `「${pendingDelete?.label ?? ''}」を削除します。この操作は元に戻せません。`}
        confirmLabel={pendingDelete?.kind === 'trip' ? '旅行を削除' : '記録を削除'}
        processing={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(undefined)}
      />
    </article>
  );
}

function TripJournalHero({ trip, placeNames, coverSource }: { trip: Trip; placeNames: string[]; coverSource?: string }) {
  const status = getTripDisplayStatus(trip);
  return (
    <header className="trip-journal-hero">
      <TripJournalVisual trip={trip} placeNames={placeNames} src={coverSource} alt={`${trip.title}の代表写真`} />
      <div className="trip-journal-hero__shade" aria-hidden="true" />
      <Link className="trip-journal-hero__back" to="/trips" aria-label="旅行一覧へ戻る"><span aria-hidden="true">←</span></Link>
      <div className="trip-journal-hero__content">
        <div className="trip-journal-hero__meta"><span>{trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</span><span>{getTripDisplayStatusLabel(status)}</span></div>
        <h1>{trip.title}</h1>
        <time dateTime={trip.startDate}>{formatCompactDateRange(trip.startDate, trip.endDate)}</time>
        <p>{trip.purpose || trip.memo || '旅の記録'}</p>
      </div>
    </header>
  );
}

function TripSummary({ data }: { data: TripDetail }) {
  const duration = data.transportLegs.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0);
  const modes = [...new Set(data.transportLegs.map((leg) => TRANSPORT_MODE_LABELS[leg.transportMode]))];
  return (
    <section className="trip-journal-summary" aria-labelledby="trip-summary-title">
      <h2 id="trip-summary-title">旅の概要</h2>
      <div className="trip-journal-summary__grid">
        <SummaryItem icon="calendar" value={tripDayLabel(data.trip)} label="日程" />
        <SummaryItem icon="pin" value={`${data.places.length}か所`} label="訪問場所" />
        <SummaryItem icon="route" value={modes.join('・') || '未記録'} label="移動手段" />
        <SummaryItem icon="clock" value={duration ? formatDuration(duration) : '未記録'} label="移動時間" />
        <SummaryItem icon="wallet" value={formatYen(data.transportSummary.totalCost)} label="交通費" />
      </div>
    </section>
  );
}

function SummaryItem({ icon, value, label }: { icon: JournalIconKind; value: string; label: string }) {
  return <div className="trip-journal-summary__item"><JournalIcon kind={icon} /><strong>{value}</strong><span>{label}</span></div>;
}

function JournalSection({ id, eyebrow, title, className = '', children }: { id: string; eyebrow: string; title: string; className?: string; children: ReactNode }) {
  return <section className={`trip-journal-section ${className}`.trim()} aria-labelledby={id}><div className="trip-journal-section__heading"><span>{eyebrow}</span><h2 id={id}>{title}</h2></div>{children}</section>;
}

function JourneyTrail({ trip, places, transportLegs }: { trip: Trip; places: PlaceVisit[]; transportLegs: TripTransportLeg[] }) {
  const distance = transportLegs.reduce((sum, leg) => sum + (leg.distanceKm || 0), 0);
  const duration = transportLegs.reduce((sum, leg) => sum + (leg.durationMinutes || 0), 0);
  const markerCount = Math.max(2, Math.min(7, places.length + 2));
  const points = Array.from({ length: markerCount }, (_, index) => {
    const x = 24 + (index * 252) / (markerCount - 1);
    const y = 76 - Math.sin((index + trip.title.length % 3) * 1.35) * 28;
    return { x, y };
  });
  return (
    <div className="trip-journal-route">
      <svg viewBox="0 0 300 120" role="img" aria-label="記録された立ち寄り先を順番に結んだルート概要">
        <path className="trip-journal-route__grid" d="M0 30H300M0 60H300M0 90H300M50 0V120M100 0V120M150 0V120M200 0V120M250 0V120" />
        <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} />
        {points.map(({ x, y }, index) => <circle key={`${x}-${y}`} cx={x} cy={y} r={index === 0 || index === points.length - 1 ? 5 : 4} />)}
      </svg>
      <p>記録された移動と立ち寄り先を、旅の順番で結んだ軌跡です。</p>
      <div className="trip-journal-route__stats">
        <span><strong>{distance ? `${distance.toFixed(1)} km` : '未記録'}</strong>移動距離</span>
        <span><strong>{duration ? formatDuration(duration) : '未記録'}</strong>移動時間</span>
        <span><strong>{transportLegs.length}区間</strong>ルート記録</span>
      </div>
    </div>
  );
}

function TripKeepsakes({ data, photoCount }: { data: TripDetail; photoCount: number }) {
  const castleCount = data.places.filter((place) => place.castleId).length;
  const keepsakes = [
    { icon: 'pin' as const, title: `${data.places.length}か所を記録`, detail: '訪問場所' },
    { icon: 'route' as const, title: `${data.transportLegs.length}区間を記録`, detail: '旅のルート' },
    { icon: 'photo' as const, title: `${photoCount}枚の写真`, detail: 'スクラップブック' },
    ...(castleCount > 0 ? [{ icon: 'castle' as const, title: `城コレクション +${castleCount}`, detail: 'この旅で登城' }] : []),
  ];
  return (
    <>
      <div className="trip-journal-keepsakes">{keepsakes.map((item) => <div key={item.title}><JournalIcon kind={item.icon} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>)}</div>
      <Link className="trip-journal-text-link" to={`/trips/${data.trip.id}/result`}>旅行リザルトを見る <span aria-hidden="true">→</span></Link>
    </>
  );
}

function TripJournalEditor({
  data, tripId, editingPlace, editingTransportLeg, setEditingPlace, setEditingTransportLeg, setPendingDelete, runAction,
}: {
  data: TripDetail;
  tripId?: string;
  editingPlace?: PlaceVisit;
  editingTransportLeg?: TripTransportLeg;
  setEditingPlace: (place?: PlaceVisit) => void;
  setEditingTransportLeg: (leg?: TripTransportLeg) => void;
  setPendingDelete: (value?: PendingDelete) => void;
  runAction: (action: () => Promise<void>, fallback: string) => Promise<void>;
}) {
  return (
    <section className="trip-journal-editor" aria-labelledby="trip-editor-title">
      <div className="trip-journal-section__heading"><span>Edit</span><h2 id="trip-editor-title">旅を編集する</h2></div>
      <nav className="trip-journal-editor__links" aria-label="旅行の編集メニュー">
        <Link to={`/trips/${data.trip.id}/edit`}>基本情報を編集 <span aria-hidden="true">→</span></Link>
        <Link to={`/trips/${data.trip.id}/scrapbook`}>写真と文章を編集 <span aria-hidden="true">→</span></Link>
      </nav>

      <details className="trip-journal-editor__panel" open={Boolean(editingPlace) || undefined}>
        <summary>訪問場所を追加・編集 <span>{data.places.length}件</span></summary>
        <div className="trip-journal-editor__body">
          {data.places.map((place) => <RecordEditorRow key={place.id} title={place.name} meta={`${isoDateTimeToDateInput(place.visitedAt) || '訪問日未設定'}${place.address ? ` / ${place.address}` : ''}`} onEdit={() => setEditingPlace(place)} onDelete={() => setPendingDelete({ kind: 'place', id: place.id, label: place.name })} />)}
          <PlaceVisitForm
            key={editingPlace?.id ?? 'new-place'} place={editingPlace} defaultVisitedDate={data.trip.startDate}
            submitLabel={editingPlace ? '場所を更新' : '場所を追加'} onCancel={editingPlace ? () => setEditingPlace(undefined) : undefined}
            onSubmit={async (input) => {
              if (!tripId) return;
              await runAction(async () => {
                if (editingPlace) await updatePlaceVisit(editingPlace.id, input);
                else await createPlaceVisit(tripId, input);
                setEditingPlace(undefined);
              }, '訪問場所の保存に失敗しました。');
            }}
          />
        </div>
      </details>

      <details className="trip-journal-editor__panel" open={Boolean(editingTransportLeg) || undefined}>
        <summary>交通費・移動を追加・編集 <span>{data.transportLegs.length}区間 / {formatYen(data.transportSummary.totalCost)}</span></summary>
        <div className="trip-journal-editor__body">
          {data.transportLegs.map((leg) => <RecordEditorRow key={leg.id} title={`${leg.fromName} → ${leg.toName}`} meta={`${leg.date} / ${TRANSPORT_MODE_LABELS[leg.transportMode]} / ${formatYen(leg.totalCost)}`} onEdit={() => setEditingTransportLeg(leg)} onDelete={() => setPendingDelete({ kind: 'leg', id: leg.id, label: `${leg.fromName} → ${leg.toName}` })} />)}
          <TransportLegForm
            key={editingTransportLeg?.id ?? 'new-transport-leg'} leg={editingTransportLeg} defaultDate={data.trip.startDate}
            submitLabel={editingTransportLeg ? '移動区間を更新' : '移動区間を追加'} onCancel={editingTransportLeg ? () => setEditingTransportLeg(undefined) : undefined}
            onSubmit={async (input) => {
              if (!tripId) return;
              await runAction(async () => {
                if (editingTransportLeg) await updateTripTransportLeg(editingTransportLeg.id, input);
                else await createTripTransportLeg(tripId, input);
                setEditingTransportLeg(undefined);
              }, '移動区間の保存に失敗しました。');
            }}
          />
        </div>
      </details>

      <div className="trip-detail__danger">
        <p>この旅行と紐づく訪問場所・移動区間も削除されます。</p>
        <Button variant="danger" onClick={() => setPendingDelete({ kind: 'trip', label: data.trip.title })}>この旅行を削除</Button>
      </div>
    </section>
  );
}

function RecordEditorRow({ title, meta, onEdit, onDelete }: { title: string; meta: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="trip-journal-editor__record"><div><strong>{title}</strong><span>{meta}</span></div><div><Button size="sm" onClick={onEdit}>編集</Button><Button size="sm" variant="danger" onClick={onDelete}>削除</Button></div></div>;
}

function JournalState({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="trip-journal-state"><PageHeader title={title} description={description} backTo="/trips" backLabel="旅行一覧へ" />{children}</div>;
}

type JournalIconKind = 'calendar' | 'pin' | 'route' | 'clock' | 'wallet' | 'photo' | 'castle';

function JournalIcon({ kind }: { kind: JournalIconKind }) {
  const paths = {
    calendar: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 3v6m8-6v6M4 11h16" /></>,
    pin: <><path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    route: <><circle cx="6" cy="17" r="2" /><circle cx="18" cy="7" r="2" /><path d="M7.5 15.5c2-3 4-1 5.5-4s3-3 4-3" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    wallet: <><path d="M4 7h14a2 2 0 0 1 2 2v9H4zM4 7V5h13v2M15 12h5v4h-5z" /></>,
    photo: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m5 17 4-4 3 3 3-4 4 5" /></>,
    castle: <><path d="M5 10h14v10H5zM3 10l3-4 2 2 4-5 4 5 2-2 3 4M9 20v-5h6v5" /></>,
  };
  return <span className="trip-journal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg></span>;
}

const TRANSPORT_MODE_LABELS: Record<TripTransportLeg['transportMode'], string> = {
  walk: '徒歩', bike: '自転車', train: '電車', shinkansen: '新幹線', bus: 'バス', car: '車',
  flight: '飛行機', ship: '船', taxi: 'タクシー', other: 'その他',
};

function tripDayLabel(trip: Trip): string {
  if (trip.tripType === 'dayTrip') return '日帰り';
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T00:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return `${days - 1}泊${days}日`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}時間${rest ? `${rest}分` : ''}` : `${rest}分`;
}

function formatYen(value: number): string {
  return `${value.toLocaleString()}円`;
}
