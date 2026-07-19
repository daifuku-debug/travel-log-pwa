import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Trip } from '../domain/models/trip';
import { listTrips } from '../features/trips/tripService';
import {
  filterTripsForDisplay,
  getTripDisplayStatus,
  getTripDisplayStatusLabel,
  groupTripsForDisplay,
  type TripDisplayStatus,
  type TripListFilter,
} from '../features/trips/tripUi';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { formatDateRange } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Badge, Button, Card, PageHeader, SegmentedControl } from '../shared/ui';

const FILTER_OPTIONS = [
  { value: 'all' as const, label: 'すべて' },
  { value: 'upcoming' as const, label: '予定' },
  { value: 'completed' as const, label: '完了' },
];

export function TripsPage() {
  const { data: trips, error, loading } = useAsyncData(listTrips, []);
  const [filter, setFilter] = useState<TripListFilter>('all');
  const groups = useMemo(
    () => groupTripsForDisplay(filterTripsForDisplay(trips ?? [], filter)),
    [filter, trips],
  );

  return (
    <>
      <PageHeader
        title="旅行"
        description="これまでの旅と、これからの予定"
        actions={<Button variant="primary" to="/trips/new">旅行を追加</Button>}
      />

      {loading && <LoadingState variant="skeleton" message="旅行一覧を読み込み中..." />}
      {error && <ErrorState error={error} />}

      {trips && trips.length === 0 && (
        <EmptyState
          title="旅行記録がまだありません"
          description="日程や訪れた場所を残すと、旅の思い出をあとからまとめて振り返れます。"
          action={<Button variant="primary" to="/trips/new">最初の旅行を作成</Button>}
        />
      )}

      {trips && trips.length > 0 && (
        <div className="trips-content">
          <SegmentedControl label="旅行の表示" value={filter} options={FILTER_OPTIONS} onChange={setFilter} />
          {groups.length === 0 ? (
            <EmptyState title="該当する旅行はありません" description="別の表示条件を選んでください。" />
          ) : groups.map((group) => (
            <section className="trip-group" key={group.status} aria-labelledby={`trip-group-${group.status}`}>
              <div className="section-head trip-group__header">
                <h2 id={`trip-group-${group.status}`}>{group.title}</h2>
                <span className="muted">{group.trips.length}件</span>
              </div>
              <div className="trip-card-grid">
                {group.trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const status = getTripDisplayStatus(trip);
  return (
    <Card as="article" className={`trip-card trip-card--${status}`}>
      <Link className="trip-card__link" to={`/trips/${trip.id}`} aria-label={`${trip.title}の詳細を見る`}>
        <div className="trip-card__head">
          <div>
            <h3>{trip.title}</h3>
            <p className="trip-card__date">{formatDateRange(trip.startDate, trip.endDate)}</p>
          </div>
          <TripStatusBadge status={status} />
        </div>
        <p className="trip-card__purpose">{trip.purpose || '目的はまだ設定されていません'}</p>
        <div className="trip-card__meta">
          <span>{trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</span>
          <span>{trip.companions.length > 0 ? trip.companions.join('、') : 'ひとり旅'}</span>
          <span className="trip-card__arrow" aria-hidden="true">›</span>
        </div>
      </Link>
    </Card>
  );
}

function TripStatusBadge({ status }: { status: TripDisplayStatus }) {
  const variant = status === 'ongoing' ? 'success' : status === 'upcoming' ? 'info' : 'neutral';
  return <Badge variant={variant}>{getTripDisplayStatusLabel(status)}</Badge>;
}
