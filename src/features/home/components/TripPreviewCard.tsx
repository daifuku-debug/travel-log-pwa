import { Link } from 'react-router-dom';
import type { Trip } from '../../../domain/models/trip';
import { formatDateRange } from '../../../shared/date/dateUtils';
import type { TripMediaLoadState } from '../useTripMedia';
import { TripMedia } from './TripMedia';

export function TripPreviewCard({
  trip,
  media,
  tone,
}: {
  trip: Trip;
  media?: TripMediaLoadState;
  tone: 'teal' | 'blue' | 'mist';
}) {
  const src = media?.status === 'ready' ? media.src : undefined;
  return (
    <Link className="trip-preview-card" to={`/trips/${trip.id}`} aria-label={`${trip.title}の詳細を見る`}>
      <div className="trip-preview-card__media">
        <TripMedia
          src={src}
          alt={`${trip.title}の旅の写真`}
          loading={media?.status === 'loading'}
          ratio="card"
          tone={tone}
        />
        <span className="trip-preview-card__badge">{trip.tripType === 'dayTrip' ? '日帰り' : '宿泊'}</span>
      </div>
      <span className="trip-preview-card__body">
        <strong>{trip.title}</strong>
        <small>{formatDateRange(trip.startDate, trip.endDate)}</small>
      </span>
    </Link>
  );
}
