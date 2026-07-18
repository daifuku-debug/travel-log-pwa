import { Link } from 'react-router-dom';
import { getHomeSummary } from '../features/home/homeService';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { formatDateRange } from '../shared/date/dateUtils';
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
              <h2>旅行RPG</h2>
              <div className="stat-value">Lv.{data.rpg.level}</div>
              <div className="muted">{data.rpg.mainTitleName} / 次まで {data.rpg.expToNextLevel} EXP</div>
            </div>
          </div>

          <section className="card">
            <div className="section-head">
              <h2>冒険者メモ</h2>
              <div className="inline-actions">
                <Link className="button" to="/time-machine">タイムマシン</Link>
                <Link className="button" to="/rpg">プロフィール</Link>
              </div>
            </div>
            <div className="list">
              <div className="list-item">
                <div>
                  <p className="list-item__title">進行中クエスト</p>
                  <div className="list-item__meta">{data.rpg.questTitles.join(' / ') || '進行中のクエストはありません'}</div>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <p className="list-item__title">最近の実績</p>
                  <div className="list-item__meta">{data.rpg.recentAchievementNames.join(' / ') || 'まだ解除された実績はありません'}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>最近の旅行</h2>
            <div className="list">
              {data.recentTrips.map((trip) => (
                <Link className="list-item" key={trip.id} to={`/trips/${trip.id}`}>
                  <div>
                    <p className="list-item__title">{trip.title}</p>
                    <div className="list-item__meta">
                      {formatDateRange(trip.startDate, trip.endDate)}
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
