import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FeatureShortcut } from '../features/home/components/FeatureShortcut';
import { TripHero } from '../features/home/components/TripHero';
import { TripMedia } from '../features/home/components/TripMedia';
import { TripPreviewCard } from '../features/home/components/TripPreviewCard';
import { getHomeSummary } from '../features/home/homeService';
import { useTripMedia } from '../features/home/useTripMedia';
import { JapanMapPreview } from '../features/japanConquest/components/JapanMapPreview';
import { getJapanConquestData } from '../features/japanConquest/japanConquestService';
import { ErrorState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { InlineError, ProgressBar, Skeleton } from '../shared/ui';

export function HomePage() {
  const home = useAsyncData(getHomeSummary, []);
  const conquest = useAsyncData(getJapanConquestData, []);
  const tripIds = home.data
    ? [home.data.featuredTrip?.trip.id, ...home.data.recentTrips.map((trip) => trip.id)].filter((id): id is string => Boolean(id))
    : [];
  const mediaByTripId = useTripMedia(tripIds);

  if (home.loading) return <HomeLoadingState />;
  if (home.error) return <ErrorState error={home.error} />;
  if (!home.data) return null;

  const data = home.data;
  const scrapbookPath = data.featuredTrip ? `/trips/${data.featuredTrip.trip.id}/scrapbook` : '/trips';

  return (
    <div className="home-dashboard">
      {data.featuredTrip ? (
        <TripHero
          featured={data.featuredTrip}
          media={mediaByTripId[data.featuredTrip.trip.id]}
        />
      ) : (
        <EmptyHomeHero />
      )}

      <div className="home-content-surface">
        {data.recentTrips.length > 0 && (
          <section className="home-section" aria-labelledby="recent-trips-title">
            <SectionHeading id="recent-trips-title" eyebrow="旅のアルバム" title="最近の旅行" to="/trips" />
            <div className="home-recent-trips">
              {data.recentTrips.map((trip) => (
                <TripPreviewCard
                  key={trip.id}
                  trip={trip}
                  media={mediaByTripId[trip.id]}
                />
              ))}
            </div>
          </section>
        )}

        {conquest.loading && (
          <section className="home-map-preview home-map-preview--loading" aria-label="日本制覇マップを読み込み中">
            <Skeleton variant="line" className="home-map-preview__title-skeleton" />
            <Skeleton variant="block" className="home-map-preview__map-skeleton" />
          </section>
        )}
        {conquest.error && (
          <section className="home-section" aria-label="日本制覇マップの読み込みエラー">
            <InlineError title="日本制覇マップを表示できません" message={conquest.error.message} />
          </section>
        )}
        {conquest.data && <JapanMapPreview views={conquest.data.allViews} summary={conquest.data.summary} />}

      <section className="home-section" aria-labelledby="home-features-title">
        <SectionHeading id="home-features-title" eyebrow="次の旅につながる" title="よく使う機能" />
        <div className="home-feature-shortcuts">
          <FeatureShortcut
            to="/time-machine"
            title="タイムマシン"
            description="過去の旅を日付から探す"
            icon={<FeatureIcon kind="clock" />}
            variant="time-machine"
          />
          <FeatureShortcut
            to="/travel-gacha"
            title="旅ガチャ"
            description="次の旅先候補を抽選"
            icon={<FeatureIcon kind="gacha" />}
            variant="gacha"
          />
          <FeatureShortcut
            to="/castles"
            title="城コレクション"
            description="日本の名城を集める"
            icon={<FeatureIcon kind="castle" />}
            variant="castle"
          />
          <FeatureShortcut
            to={scrapbookPath}
            title="スクラップブック"
            description="旅の思い出を編集"
            icon={<FeatureIcon kind="book" />}
            variant="scrapbook"
          />
        </div>
        </section>

        <section className="home-section home-stats-section" aria-labelledby="home-progress-title">
          <SectionHeading id="home-progress-title" eyebrow="積み重ね" title="旅の記録" to="/rpg" linkLabel="RPGを見る" />
          <div className="home-stats">
            <Stat icon={<FeatureIcon kind="suitcase" />} value={data.tripCount} label="旅行" />
            <Stat icon={<FeatureIcon kind="pin" />} value={data.placeVisitCount} label="訪問場所" />
            <Stat icon={<FeatureIcon kind="hero" />} value={`Lv.${data.rpg.level}`} label={data.rpg.mainTitleName} />
          </div>
          <ProgressBar
            label="コレクション達成率"
            value={data.collectionAchievementRate}
            valueText={`${data.collectionAchievementRate}%`}
          />
          {(data.rpg.questTitles.length > 0 || data.rpg.recentAchievementNames.length > 0) && (
            <div className="home-achievement-list">
              {data.rpg.questTitles.length > 0 && <p><strong>進行中</strong><span>{data.rpg.questTitles.join(' / ')}</span></p>}
              {data.rpg.recentAchievementNames.length > 0 && <p><strong>最近の実績</strong><span>{data.rpg.recentAchievementNames.join(' / ')}</span></p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyHomeHero() {
  return (
    <section className="home-hero home-hero--empty" aria-labelledby="home-hero-title">
      <TripMedia alt="旅の記録を始めるための風景" ratio="hero" eager fallbackKey="empty-travel-journal" />
      <div className="home-hero__shade" aria-hidden="true" />
      <div className="home-hero__content">
        <span className="home-hero__eyebrow">Travel Journal</span>
        <h1 id="home-hero-title">次の旅が、<br />きっともっと好きになる。</h1>
        <p className="home-hero__story">写真と地図に、旅の記憶を少しずつ残しましょう。</p>
        <Link className="home-hero__cta" to="/trips/new">最初の旅行を追加 <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  to,
  linkLabel = 'すべて見る',
}: {
  id: string;
  eyebrow: string;
  title: string;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div className="home-section-heading">
      <div><span className="home-section-heading__eyebrow">{eyebrow}</span><h2 id={id}>{title}</h2></div>
      {to && <Link to={to}>{linkLabel} <span aria-hidden="true">→</span></Link>}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return (
    <div className="home-stat">
      <span className="home-stat__icon" aria-hidden="true">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function HomeLoadingState() {
  return (
    <div className="home-dashboard home-dashboard--loading" aria-live="polite" aria-busy="true">
      <span className="sr-only">ホームを読み込み中...</span>
      <Skeleton variant="block" className="home-loading__hero" />
      <Skeleton variant="line" className="home-loading__heading" />
      <div className="home-loading__cards">
        <Skeleton variant="block" /><Skeleton variant="block" /><Skeleton variant="block" />
      </div>
      <Skeleton variant="block" className="home-loading__map" />
    </div>
  );
}

function FeatureIcon({ kind }: { kind: 'clock' | 'gacha' | 'castle' | 'book' | 'suitcase' | 'pin' | 'hero' }) {
  const paths = {
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2M5 5 3 2M19 5l-3 2" /></>,
    gacha: <><path d="M7 4h10l2 7H5l2-7ZM6 11h12v9H6z" /><circle cx="12" cy="15" r="2.5" /><path d="M9 4V2h6v2" /></>,
    castle: <><path d="M5 10h14v10H5zM3 10l3-4 2 2 4-5 4 5 2-2 3 4M9 20v-5h6v5M8 10V7m8 3V7" /></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z" /></>,
    suitcase: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V4h6v3M8 11v5m8-5v5M4 14h16" /></>,
    pin: <><path d="M12 22s7-6 7-13a7 7 0 0 0-14 0c0 7 7 13 7 13Z" /><circle cx="12" cy="9" r="2.5" /></>,
    hero: <><path d="M7 21h10M8 17l-2-7 3-5 3 3 3-3 3 5-2 7H8Z" /><path d="M9 11h6M12 8v6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}
