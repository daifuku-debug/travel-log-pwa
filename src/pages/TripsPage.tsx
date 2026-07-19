import { Link } from 'react-router-dom';
import { listTrips } from '../features/trips/tripService';
import { formatDateRange } from '../shared/date/dateUtils';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Badge, Button, Card, PageHeader } from '../shared/ui';

export function TripsPage() {
  const { data: trips, error, loading } = useAsyncData(listTrips, []);

  return (
    <>
      <PageHeader
        title="旅行一覧"
        description="旅行・日帰りのお出かけ記録を一覧で管理します。"
        actions={<Button variant="primary" to="/trips/new">新規作成</Button>}
      />

      {loading && <LoadingState variant="skeleton" message="旅行一覧を読み込み中..." />}
      {error && <ErrorState error={error} />}

      {trips && trips.length === 0 && (
        <EmptyState
          title="旅行記録がまだありません"
          description="最初の旅行を登録して、旅の記録を始めましょう。"
          action={<Button variant="primary" to="/trips/new">最初の旅行を作成</Button>}
        />
      )}

      {trips && trips.length > 0 && (
        <Card>
          <div className="list">
            {trips.map((trip) => (
              <Link className="list-item" key={trip.id} to={`/trips/${trip.id}`}>
                <div>
                  <p className="list-item__title">{trip.title}</p>
                  <div className="list-item__meta">
                    {formatDateRange(trip.startDate, trip.endDate)} /{' '}
                    {trip.companions.join(', ') || '同行者なし'}
                  </div>
                  <div className="list-item__meta">{trip.purpose || '目的未設定'}</div>
                </div>
                <Badge variant={trip.tripType === 'dayTrip' ? 'info' : 'primary'}>
                  {trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
