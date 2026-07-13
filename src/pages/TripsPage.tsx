import { Link } from 'react-router-dom';
import { listTrips } from '../features/trips/tripService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function TripsPage() {
  const { data: trips, error, loading } = useAsyncData(listTrips, []);

  return (
    <>
      <section className="page-heading">
        <h1>旅行一覧</h1>
        <p>旅行・日帰りのお出かけ記録を一覧で管理します。作成や編集は次のフェーズで追加します。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {trips && trips.length === 0 && <EmptyState>まだ旅行記録がありません。</EmptyState>}

      {trips && trips.length > 0 && (
        <div className="list">
          {trips.map((trip) => (
            <Link className="list-item" key={trip.id} to={`/trips/${trip.id}`}>
              <div>
                <p className="list-item__title">{trip.title}</p>
                <div className="list-item__meta">
                  {trip.startDate} - {trip.endDate} / {trip.companions.join(', ') || '同行者なし'}
                </div>
              </div>
              <span className="muted">{trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
