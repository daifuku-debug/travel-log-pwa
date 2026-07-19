import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PlaceVisit, TripTransportLeg } from '../domain/models/trip';
import { PlaceVisitForm } from '../features/trips/components/PlaceVisitForm';
import { TransportLegForm } from '../features/trips/components/TransportLegForm';
import {
  createPlaceVisit,
  createTripTransportLeg,
  deletePlaceVisit,
  deleteTrip,
  deleteTripTransportLeg,
  getTripDetail,
  updatePlaceVisit,
  updateTripTransportLeg,
} from '../features/trips/tripService';
import { getTripDisplayStatus, getTripDisplayStatusLabel } from '../features/trips/tripUi';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { formatDateRange, isoDateTimeToDateInput } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Badge, Button, Card, ConfirmDialog, InlineError, PageHeader } from '../shared/ui';

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

  return (
    <>
      <PageHeader
        title={data?.trip.title ?? '旅行詳細'}
        description={data ? formatDateRange(data.trip.startDate, data.trip.endDate) : '旅行の記録を確認します。'}
        backTo="/trips"
        backLabel="旅行一覧へ"
        actions={data && <Button to={`/trips/${data.trip.id}/edit`}>旅行を編集</Button>}
      />

      {loading && <LoadingState variant="skeleton" message="旅行詳細を読み込み中..." />}
      {error && <ErrorState error={error} />}
      {actionError && <InlineError message={actionError} />}

      {!loading && !error && !data && (
        <EmptyState
          title="旅行が見つかりません"
          description="削除されたか、URLが正しくない可能性があります。"
          action={<Button to="/trips">旅行一覧へ戻る</Button>}
        />
      )}

      {data && (
        <div className="trip-detail">
          <TripOverview trip={data.trip} />

          <Card className="trip-detail__memory" title="旅の思い出">
            <p className="muted">写真と文章をまとめたり、旅の成果を振り返ったりできます。</p>
            <div className="trip-detail__primary-actions">
              <Button variant="primary" to={`/trips/${data.trip.id}/scrapbook`}>スクラップブックを見る</Button>
              <Button to={`/trips/${data.trip.id}/result`}>旅行リザルト</Button>
            </div>
          </Card>

          <Card
            title="交通費・移動"
            actions={<span className="muted">{data.transportSummary.legCount}区間 / {formatYen(data.transportSummary.totalCost)}</span>}
          >
            <div className="transport-summary">
              <div className="summary-card"><strong>{formatYen(data.transportSummary.totalCost)}</strong><span>交通費合計</span></div>
              <div className="summary-card"><strong>{formatYen(data.transportSummary.manualCost)}</strong><span>手入力</span></div>
              <div className="summary-card"><strong>{formatYen(data.transportSummary.apiCost)}</strong><span>API計算</span></div>
            </div>
            {data.transportLegs.length === 0 ? (
              <EmptyState title="移動区間はまだありません" description="下のフォームから移動と交通費を追加できます。" />
            ) : (
              <div className="list trip-detail__records">
                {data.transportLegs.map((leg) => (
                  <div className="list-item" key={leg.id}>
                    <div>
                      <p className="list-item__title">{leg.fromName} → {leg.toName}</p>
                      <div className="list-item__meta">{leg.date} / {TRANSPORT_MODE_LABELS[leg.transportMode]} / {formatYen(leg.totalCost)}</div>
                      <div className="list-item__meta">
                        {[leg.departureTime, leg.arrivalTime].filter(Boolean).join(' → ') || '時刻未設定'}
                        {leg.durationMinutes ? ` / 約${leg.durationMinutes}分` : ''}
                        {leg.memo ? ` / ${leg.memo}` : ''}
                      </div>
                    </div>
                    <div className="inline-actions">
                      <Button size="sm" onClick={() => setEditingTransportLeg(leg)}>編集</Button>
                      <Button size="sm" variant="danger" onClick={() => setPendingDelete({ kind: 'leg', id: leg.id, label: `${leg.fromName} → ${leg.toName}` })}>削除</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="行った場所" actions={<span className="muted">{data.places.length}件</span>}>
            {data.places.length === 0 ? (
              <EmptyState title="訪問場所はまだありません" description="下のフォームから旅の立ち寄り先を追加できます。" />
            ) : (
              <div className="list trip-detail__records">
                {data.places.map((place) => (
                  <div className="list-item" key={place.id}>
                    <div>
                      <p className="list-item__title">{place.name}</p>
                      <div className="list-item__meta">
                        {isoDateTimeToDateInput(place.visitedAt) || '訪問日未設定'}{place.address ? ` / ${place.address}` : ''}
                      </div>
                      <div className="list-item__meta">{place.memo || 'メモなし'}</div>
                    </div>
                    <div className="inline-actions">
                      <Button size="sm" onClick={() => setEditingPlace(place)}>編集</Button>
                      <Button size="sm" variant="danger" onClick={() => setPendingDelete({ kind: 'place', id: place.id, label: place.name })}>削除</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="trip-detail__forms">
            <Card title={editingPlace ? '訪問場所を編集' : '訪問場所を追加'}>
              <PlaceVisitForm
                key={editingPlace?.id ?? 'new-place'}
                place={editingPlace}
                defaultVisitedDate={data.trip.startDate}
                submitLabel={editingPlace ? '場所を更新' : '場所を追加'}
                onCancel={editingPlace ? () => setEditingPlace(undefined) : undefined}
                onSubmit={async (input) => {
                  if (!tripId) return;
                  await runAction(async () => {
                    if (editingPlace) await updatePlaceVisit(editingPlace.id, input);
                    else await createPlaceVisit(tripId, input);
                    setEditingPlace(undefined);
                  }, '訪問場所の保存に失敗しました。');
                }}
              />
            </Card>

            <Card title={editingTransportLeg ? '移動区間を編集' : '移動区間を追加'}>
              <TransportLegForm
                key={editingTransportLeg?.id ?? 'new-transport-leg'}
                leg={editingTransportLeg}
                defaultDate={data.trip.startDate}
                submitLabel={editingTransportLeg ? '移動区間を更新' : '移動区間を追加'}
                onCancel={editingTransportLeg ? () => setEditingTransportLeg(undefined) : undefined}
                onSubmit={async (input) => {
                  if (!tripId) return;
                  await runAction(async () => {
                    if (editingTransportLeg) await updateTripTransportLeg(editingTransportLeg.id, input);
                    else await createTripTransportLeg(tripId, input);
                    setEditingTransportLeg(undefined);
                  }, '移動区間の保存に失敗しました。');
                }}
              />
            </Card>
          </div>

          <section className="trip-detail__danger" aria-labelledby="trip-management-title">
            <h2 id="trip-management-title">旅行の管理</h2>
            <p className="muted">この旅行と紐づく訪問場所・移動区間も削除されます。</p>
            <Button variant="danger" onClick={() => setPendingDelete({ kind: 'trip', label: data.trip.title })}>旅行を削除</Button>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'trip' ? 'この旅行を削除しますか？' : 'この記録を削除しますか？'}
        description={pendingDelete?.kind === 'trip' ? `「${pendingDelete.label}」と紐づく記録も削除され、元に戻せません。` : `「${pendingDelete?.label ?? ''}」を削除します。この操作は元に戻せません。`}
        confirmLabel={pendingDelete?.kind === 'trip' ? '旅行を削除' : '記録を削除'}
        processing={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(undefined)}
      />
    </>
  );
}

function TripOverview({ trip }: { trip: NonNullable<Awaited<ReturnType<typeof getTripDetail>>>['trip'] }) {
  const status = getTripDisplayStatus(trip);
  const badgeVariant = status === 'ongoing' ? 'success' : status === 'upcoming' ? 'info' : 'neutral';
  return (
    <Card className="trip-overview">
      <div className="trip-overview__headline">
        <div>
          <p className="trip-overview__date">{formatDateRange(trip.startDate, trip.endDate)}</p>
          <h2>{trip.purpose || '旅の目的は未設定です'}</h2>
        </div>
        <Badge variant={badgeVariant}>{getTripDisplayStatusLabel(status)}</Badge>
      </div>
      <dl className="trip-info-grid">
        <div><dt>旅行タイプ</dt><dd>{trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</dd></div>
        <div><dt>同行者</dt><dd>{trip.companions.join('、') || 'ひとり旅'}</dd></div>
        <div className="trip-info-grid__wide"><dt>メモ</dt><dd>{trip.memo || 'メモはありません'}</dd></div>
      </dl>
    </Card>
  );
}

const TRANSPORT_MODE_LABELS: Record<TripTransportLeg['transportMode'], string> = {
  walk: '徒歩', bike: '自転車', train: '電車', shinkansen: '新幹線', bus: 'バス', car: '車',
  flight: '飛行機', ship: '船', taxi: 'タクシー', other: 'その他',
};

function formatYen(value: number): string {
  return `${value.toLocaleString()}円`;
}
