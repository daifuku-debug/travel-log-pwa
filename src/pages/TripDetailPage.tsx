import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlaceVisitForm } from '../features/trips/components/PlaceVisitForm';
import { TransportLegForm } from '../features/trips/components/TransportLegForm';
import {
  createTripTransportLeg,
  createPlaceVisit,
  deleteTripTransportLeg,
  deletePlaceVisit,
  deleteTrip,
  getTripDetail,
  updateTripTransportLeg,
  updatePlaceVisit,
} from '../features/trips/tripService';
import type { PlaceVisit, TripTransportLeg } from '../domain/models/trip';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { formatDateRange, isoDateTimeToDateInput } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function TripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [editingPlace, setEditingPlace] = useState<PlaceVisit | undefined>();
  const [editingTransportLeg, setEditingTransportLeg] = useState<TripTransportLeg | undefined>();
  const { data, error, loading } = useAsyncData(
    () => (tripId ? getTripDetail(tripId) : Promise.resolve(undefined)),
    [tripId, reloadKey],
  );

  async function handleDeleteTrip() {
    if (!tripId || !window.confirm('この旅行と紐づく訪問場所を削除しますか？')) return;
    await deleteTrip(tripId);
    navigate('/trips');
  }

  async function handleDeletePlace(place: PlaceVisit) {
    if (!window.confirm(`「${place.name}」を削除しますか？`)) return;
    await deletePlaceVisit(place.id);
    setReloadKey((value) => value + 1);
  }

  async function handleDeleteTransportLeg(leg: TripTransportLeg) {
    if (!window.confirm(`「${leg.fromName} → ${leg.toName}」を削除しますか？`)) return;
    await deleteTripTransportLeg(leg.id);
    setReloadKey((value) => value + 1);
  }

  return (
    <>
      <section className="page-heading">
        <h1>{data?.trip.title ?? '旅行詳細'}</h1>
        <p>基本情報、行った場所、後で買いたいもの、関連コレクションをまとめる画面です。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {!loading && !error && !data && (
        <EmptyState>
          旅行が見つかりません。 <Link to="/trips">旅行一覧へ戻る</Link>
        </EmptyState>
      )}

      {data && (
        <div className="grid">
          <section className="card">
            <div className="section-head">
              <h2>基本情報</h2>
              <div className="inline-actions">
                <Link className="button" to={`/trips/${data.trip.id}/edit`}>
                  編集
                </Link>
                <Link className="button" to={`/trips/${data.trip.id}/result`}>
                  リザルト
                </Link>
                <Link className="button" to={`/trips/${data.trip.id}/scrapbook`}>
                  スクラップブック
                </Link>
                <button className="button button--danger" type="button" onClick={handleDeleteTrip}>
                  削除
                </button>
              </div>
            </div>
            <p>{formatDateRange(data.trip.startDate, data.trip.endDate)} / {data.trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</p>
            <p className="muted">目的: {data.trip.purpose || '未設定'}</p>
            <p className="muted">同行者: {data.trip.companions.join(', ') || 'なし'}</p>
            <p>{data.trip.memo || 'メモはありません。'}</p>
          </section>

          <section className="card">
            <div className="section-head">
              <h2>交通費・移動</h2>
              <span className="muted">{data.transportSummary.legCount}区間 / {formatYen(data.transportSummary.totalCost)}</span>
            </div>
            <div className="transport-summary">
              <div className="summary-card"><strong>{formatYen(data.transportSummary.totalCost)}</strong><span>交通費合計</span></div>
              <div className="summary-card"><strong>{formatYen(data.transportSummary.manualCost)}</strong><span>手入力</span></div>
              <div className="summary-card"><strong>{formatYen(data.transportSummary.apiCost)}</strong><span>API計算</span></div>
            </div>
            {data.transportLegs.length === 0 ? (
              <EmptyState>まだ移動区間が登録されていません。</EmptyState>
            ) : (
              <div className="list">
                {data.transportLegs.map((leg) => (
                  <div className="list-item" key={leg.id}>
                    <div>
                      <p className="list-item__title">{leg.fromName} → {leg.toName}</p>
                      <div className="list-item__meta">
                        {leg.date} / {TRANSPORT_MODE_LABELS[leg.transportMode]} / {formatYen(leg.totalCost)}
                      </div>
                      <div className="list-item__meta">
                        {[leg.departureTime, leg.arrivalTime].filter(Boolean).join(' → ') || '時刻未設定'}
                        {leg.durationMinutes ? ` / 約${leg.durationMinutes}分` : ''}
                        {leg.memo ? ` / ${leg.memo}` : ''}
                      </div>
                    </div>
                    <div className="inline-actions">
                      <button className="button" type="button" onClick={() => setEditingTransportLeg(leg)}>
                        編集
                      </button>
                      <button className="button button--danger" type="button" onClick={() => void handleDeleteTransportLeg(leg)}>
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <h2>行った場所</h2>
              <span className="muted">{data.places.length}件</span>
            </div>
            {data.places.length === 0 ? (
              <EmptyState>まだ場所が登録されていません。</EmptyState>
            ) : (
              <div className="list">
                {data.places.map((place) => (
                  <div className="list-item" key={place.id}>
                    <div>
                      <p className="list-item__title">{place.name}</p>
                      <div className="list-item__meta">
                        {isoDateTimeToDateInput(place.visitedAt) || '訪問日未設定'}
                        {place.address ? ` / ${place.address}` : ''}
                      </div>
                      <div className="list-item__meta">{place.memo || 'メモなし'}</div>
                    </div>
                    <div className="inline-actions">
                      <button className="button" type="button" onClick={() => setEditingPlace(place)}>
                        編集
                      </button>
                      <button className="button button--danger" type="button" onClick={() => void handleDeletePlace(place)}>
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>{editingPlace ? '訪問場所を編集' : '訪問場所を追加'}</h2>
            <PlaceVisitForm
              key={editingPlace?.id ?? 'new-place'}
              place={editingPlace}
              defaultVisitedDate={data.trip.startDate}
              submitLabel={editingPlace ? '場所を更新' : '場所を追加'}
              onCancel={editingPlace ? () => setEditingPlace(undefined) : undefined}
              onSubmit={async (input) => {
                if (!tripId) return;
                if (editingPlace) {
                  await updatePlaceVisit(editingPlace.id, input);
                  setEditingPlace(undefined);
                } else {
                  await createPlaceVisit(tripId, input);
                }
                setReloadKey((value) => value + 1);
              }}
            />
          </section>

          <section className="card">
            <h2>{editingTransportLeg ? '移動区間を編集' : '移動区間を追加'}</h2>
            <TransportLegForm
              key={editingTransportLeg?.id ?? 'new-transport-leg'}
              leg={editingTransportLeg}
              defaultDate={data.trip.startDate}
              submitLabel={editingTransportLeg ? '移動区間を更新' : '移動区間を追加'}
              onCancel={editingTransportLeg ? () => setEditingTransportLeg(undefined) : undefined}
              onSubmit={async (input) => {
                if (!tripId) return;
                if (editingTransportLeg) {
                  await updateTripTransportLeg(editingTransportLeg.id, input);
                  setEditingTransportLeg(undefined);
                } else {
                  await createTripTransportLeg(tripId, input);
                }
                setReloadKey((value) => value + 1);
              }}
            />
          </section>
        </div>
      )}
    </>
  );
}

const TRANSPORT_MODE_LABELS: Record<TripTransportLeg['transportMode'], string> = {
  walk: '徒歩',
  bike: '自転車',
  train: '電車',
  shinkansen: '新幹線',
  bus: 'バス',
  car: '車',
  flight: '飛行機',
  ship: '船',
  taxi: 'タクシー',
  other: 'その他',
};

function formatYen(value: number): string {
  return `${value.toLocaleString()}円`;
}
