import { Link } from 'react-router-dom';
import type { Trip } from '../domain/models/trip';
import type { FeaturedTrip } from '../features/home/homeLogic';
import { getHomeSummary } from '../features/home/homeService';
import { getTripDisplayStatusLabel } from '../features/trips/tripUi';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { formatDateRange } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Badge, Button, Card, NavigationListItem, PageHeader, ProgressBar } from '../shared/ui';

export function HomePage() {
  const { data, error, loading } = useAsyncData(getHomeSummary, []);

  return (
    <>
      <PageHeader
        title="ホーム"
        description="次の旅と、これまでに積み重ねた記録"
        actions={<Button variant="primary" to="/trips/new">旅行を追加</Button>}
      />

      {loading && <LoadingState variant="skeleton" message="ホームを読み込み中..." />}
      {error && <ErrorState error={error} />}

      {data && (
        <div className="home-dashboard">
          {data.featuredTrip ? (
            <FeaturedTripCard featured={data.featuredTrip} />
          ) : (
            <EmptyState
              title="旅の記録を始めましょう"
              description="最初の旅行を登録すると、ここに次の予定や最近の旅行が表示されます。"
              action={<Button variant="primary" to="/trips/new">最初の旅行を作成</Button>}
            />
          )}

          <section className="home-section" aria-labelledby="home-progress-title">
            <div className="section-head"><h2 id="home-progress-title">旅の記録</h2></div>
            <div className="home-progress">
              <div className="home-progress__numbers">
                <div><strong>{data.tripCount}</strong><span>旅行</span></div>
                <div><strong>{data.placeVisitCount}</strong><span>訪問場所</span></div>
                <div><strong>Lv.{data.rpg.level}</strong><span>{data.rpg.mainTitleName}</span></div>
              </div>
              <ProgressBar
                label="コレクション達成率"
                value={data.collectionAchievementRate}
                valueText={`${data.collectionAchievementRate}%`}
              />
            </div>
          </section>

          <Card title="すぐに使う">
            <div className="home-quick-actions">
              <NavigationListItem to="/travel-gacha" title="旅ガチャ" description="次の旅先候補を探す" icon="旅" />
              <NavigationListItem to="/japan-map" title="日本地図" description="訪問した都道府県を記録" icon="地" />
              <NavigationListItem to="/time-machine" title="タイムマシン" description="過去の旅を日付から振り返る" icon="時" />
            </div>
          </Card>

          {data.recentTrips.length > 0 && (
            <section className="home-section" aria-labelledby="recent-trips-title">
              <div className="section-head">
                <h2 id="recent-trips-title">最近の旅行</h2>
                <Button to="/trips" variant="ghost" size="sm">すべて見る</Button>
              </div>
              <div className="home-recent-trips">
                {data.recentTrips.map((trip) => <RecentTripLink key={trip.id} trip={trip} />)}
              </div>
            </section>
          )}

          {(data.rpg.questTitles.length > 0 || data.rpg.recentAchievementNames.length > 0) && (
            <Card title="旅の達成メモ" variant="subtle">
              <div className="home-achievement-list">
                {data.rpg.questTitles.length > 0 && <p><strong>進行中:</strong> {data.rpg.questTitles.join(' / ')}</p>}
                {data.rpg.recentAchievementNames.length > 0 && <p><strong>最近の実績:</strong> {data.rpg.recentAchievementNames.join(' / ')}</p>}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function FeaturedTripCard({ featured }: { featured: FeaturedTrip }) {
  const { trip, status } = featured;
  const eyebrow = status === 'ongoing' ? 'いまの旅行' : status === 'upcoming' ? '次の旅行' : '最近の旅行';
  const badgeVariant = status === 'ongoing' ? 'success' : status === 'upcoming' ? 'info' : 'neutral';
  return (
    <Card className={`home-featured-trip home-featured-trip--${status}`}>
      <Link to={`/trips/${trip.id}`} className="home-featured-trip__link" aria-label={`${eyebrow}「${trip.title}」の詳細を見る`}>
        <div className="home-featured-trip__head">
          <div>
            <span className="home-featured-trip__eyebrow">{eyebrow}</span>
            <h2>{trip.title}</h2>
          </div>
          <Badge variant={badgeVariant}>{getTripDisplayStatusLabel(status)}</Badge>
        </div>
        <p>{formatDateRange(trip.startDate, trip.endDate)}</p>
        <p className="muted">{trip.purpose || (trip.tripType === 'dayTrip' ? '日帰りのお出かけ' : '宿泊旅行')}</p>
        <span className="home-featured-trip__cta">詳細を見る <span aria-hidden="true">›</span></span>
      </Link>
    </Card>
  );
}

function RecentTripLink({ trip }: { trip: Trip }) {
  return (
    <Link className="home-recent-trip" to={`/trips/${trip.id}`} aria-label={`${trip.title}の詳細を見る`}>
      <span><strong>{trip.title}</strong><small>{formatDateRange(trip.startDate, trip.endDate)}</small></span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
