import { Link } from 'react-router-dom';
import type { FeaturedTrip } from '../homeLogic';
import type { TripMediaLoadState } from '../useTripMedia';
import { getTripDisplayStatusLabel } from '../../trips/tripUi';
import { formatDateRange } from '../../../shared/date/dateUtils';
import { Badge } from '../../../shared/ui';
import { TripMedia } from './TripMedia';

export function TripHero({
  featured,
  media,
}: {
  featured: FeaturedTrip;
  media?: TripMediaLoadState;
}) {
  const { trip, status } = featured;
  const badgeVariant = status === 'ongoing' ? 'success' : status === 'upcoming' ? 'info' : 'neutral';
  const src = media?.status === 'ready' ? media.src : undefined;

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <TripMedia
        src={src}
        alt={`${trip.title}の旅の写真`}
        loading={media?.status === 'loading'}
        ratio="hero"
        eager
        fallbackKey={`${trip.id}:${trip.title}:${trip.tripType}:${trip.startDate}`}
      />
      <div className="home-hero__shade" aria-hidden="true" />
      <Link className="home-hero__add" to="/trips/new" aria-label="旅行を追加">+</Link>
      <div className="home-hero__content">
        <div className="home-hero__meta">
          <span>{trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</span>
          <Badge variant={badgeVariant}>{getTripDisplayStatusLabel(status)}</Badge>
        </div>
        <h1 id="home-hero-title">{trip.title}</h1>
        <p className="home-hero__date">{formatDateRange(trip.startDate, trip.endDate)}</p>
        <p className="home-hero__story">{trip.purpose || trip.memo || '旅の記録を振り返る'}</p>
        <Link className="home-hero__cta" to={`/trips/${trip.id}`}>詳細を見る <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
