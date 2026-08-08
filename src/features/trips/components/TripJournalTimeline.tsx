import type { PlaceVisit, TripTransportLeg } from '../../../domain/models/trip';
import { getPlaceVisitDate, formatPlaceVisitTimeRange } from '../placeVisitDateTime.ts';
import {
  formatTransportLegTimeRange,
  formatTransportLegTitle,
  getTransportLegDepartureDate,
  isTransportLegInProgress,
} from '../transportLegDateTime.ts';
import { TRANSPORT_MODE_LABELS } from '../tripUi.ts';

interface TimelineEntry {
  id: string;
  date: string;
  time: string;
  title: string;
  detail: string;
  kind: 'place' | 'transport';
}

export function TripJournalTimeline({ places, transportLegs }: { places: PlaceVisit[]; transportLegs: TripTransportLeg[] }) {
  const entries = buildTimelineEntries(places, transportLegs);
  if (entries.length === 0) return <p className="trip-journal-empty-copy">訪問場所や移動を追加すると、ここに旅の流れが現れます。</p>;

  let previousDate = '';
  return (
    <ol className="trip-journal-timeline">
      {entries.map((entry) => {
        const showDate = entry.date !== previousDate;
        previousDate = entry.date;
        return (
          <li key={`${entry.kind}-${entry.id}`}>
            {showDate && <time className="trip-journal-timeline__day" dateTime={entry.date}>{formatDayLabel(entry.date)}</time>}
            <span className={`trip-journal-timeline__marker trip-journal-timeline__marker--${entry.kind}`} aria-hidden="true" />
            <div className="trip-journal-timeline__time">{entry.time}</div>
            <div className="trip-journal-timeline__story"><strong>{entry.title}</strong>{entry.detail && <span>{entry.detail}</span>}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function buildTimelineEntries(places: PlaceVisit[], transportLegs: TripTransportLeg[]): TimelineEntry[] {
  const placeEntries = places.map((place) => ({
    id: place.id,
    date: getPlaceVisitDate(place),
    time: formatPlaceVisitTimeRange(place),
    title: place.name,
    detail: place.memo || place.address || '',
    kind: 'place' as const,
  }));
  const legEntries = transportLegs.map((leg) => ({
    id: leg.id,
    date: getTransportLegDepartureDate(leg),
    time: formatTransportLegTimeRange(leg),
    title: formatTransportLegTitle(leg),
    detail: [TRANSPORT_MODE_LABELS[leg.transportMode], isTransportLegInProgress(leg) ? '移動中' : '', leg.durationMinutes ? `約${leg.durationMinutes}分` : '', leg.memo || ''].filter(Boolean).join(' ・ '),
    kind: 'transport' as const,
  }));
  return [...placeEntries, ...legEntries].sort((a, b) => `${a.date} ${sortTime(a.time)}`.localeCompare(`${b.date} ${sortTime(b.time)}`));
}

function formatDayLabel(date: string): string {
  if (!date) return '日付未設定';
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : `${parsed.getMonth() + 1}月${parsed.getDate()}日`;
}

function sortTime(value: string): string {
  const match = value.match(/^\d{2}:\d{2}/);
  return match?.[0] ?? '99:99';
}
