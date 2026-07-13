import { Link } from 'react-router-dom';
import { getHomeSummary } from '../features/home/homeService';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function HomePage() {
  const { data, error, loading } = useAsyncData(getHomeSummary, []);

  return (
    <>
      <section className="page-heading">
        <h1>ホーム</h1>
        <p>最近のお出かけ、訪問数、コレクションの達成状況をここから振り返ります。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="grid">
          <div className="grid grid--two">
            <div className="card">
              <h2>旅行数</h2>
              <div className="stat-value">{data.tripCount}</div>
              <div className="muted">端末内に保存済み</div>
            </div>
            <div className="card">
              <h2>訪問場所</h2>
              <div className="stat-value">{data.placeVisitCount}</div>
              <div className="muted">旅行に紐づく場所</div>
            </div>
            <div className="card">
              <h2>達成率</h2>
              <div className="stat-value">{data.collectionAchievementRate}%</div>
              <div className="muted">コレクション全体</div>
            </div>
            <div className="card">
              <h2>同期</h2>
              <div className="stat-value">準備中</div>
              <div className="muted">Cloudflare同期を後続フェーズで追加</div>
            </div>
          </div>

          <section className="card">
            <h2>最近の旅行</h2>
            <div className="list">
              {data.recentTrips.map((trip) => (
                <Link className="list-item" key={trip.id} to={`/trips/${trip.id}`}>
                  <div>
                    <p className="list-item__title">{trip.title}</p>
                    <div className="list-item__meta">
                      {trip.startDate} - {trip.endDate}
                    </div>
                  </div>
                  <span className="muted">{trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
