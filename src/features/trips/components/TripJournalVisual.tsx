import type { Trip } from '../../../domain/models/trip';

export function TripJournalVisual({
  trip,
  placeNames,
  src,
  alt,
  className = '',
}: {
  trip: Trip;
  placeNames: string[];
  src?: string;
  alt: string;
  className?: string;
}) {
  const theme = journalTheme([trip.title, trip.purpose, trip.memo, ...placeNames].filter(Boolean).join(' '), trip.id);
  return (
    <div className={`trip-journal-visual trip-journal-visual--${theme} ${className}`.trim()}>
      {src ? <img src={src} alt={alt} loading="eager" decoding="async" /> : (
        <div className="trip-journal-visual__fallback" aria-hidden="true">
          <span className="trip-journal-visual__light" />
          <span className="trip-journal-visual__ridge trip-journal-visual__ridge--far" />
          <span className="trip-journal-visual__ridge trip-journal-visual__ridge--near" />
          <span className="trip-journal-visual__landmark" />
          <span className="trip-journal-visual__path" />
        </div>
      )}
    </div>
  );
}

function journalTheme(text: string, seed: string): 'heritage' | 'snow' | 'sea' | 'forest' | 'mist' {
  if (/北海道|雪|冬|札幌|函館|寒/.test(text)) return 'snow';
  if (/海|島|沖縄|浜|港|水族館/.test(text)) return 'sea';
  if (/京都|奈良|寺|神社|城|町並|街歩き/.test(text)) return 'heritage';
  if (/山|森|高原|渓谷|湖|自然/.test(text)) return 'forest';
  let hash = 0;
  for (const character of `${seed}:${text}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (['heritage', 'forest', 'sea', 'mist'] as const)[hash % 4];
}
