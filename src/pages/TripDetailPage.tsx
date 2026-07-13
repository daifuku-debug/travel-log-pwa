import { Link, useParams } from 'react-router-dom';
import { getTripDetail } from '../features/trips/tripService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function TripDetailPage() {
  const { tripId } = useParams();
  const { data, error, loading } = useAsyncData(
    () => (tripId ? getTripDetail(tripId) : Promise.resolve(undefined)),
    [tripId],
  );

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
            <h2>基本情報</h2>
            <p>
              {data.trip.startDate} - {data.trip.endDate} /{' '}
              {data.trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}
            </p>
            <p className="muted">目的: {data.trip.purpose || '未設定'}</p>
            <p className="muted">同行者: {data.trip.companions.join(', ') || 'なし'}</p>
            <p>{data.trip.memo}</p>
          </section>

          <section className="card">
            <h2>行った場所</h2>
            {data.places.length === 0 ? (
              <p className="muted">まだ場所が登録されていません。</p>
            ) : (
              <div className="list">
                {data.places.map((place) => (
                  <div className="list-item" key={place.id}>
                    <div>
                      <p className="list-item__title">{place.name}</p>
                      <div className="list-item__meta">{place.memo || 'メモなし'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
