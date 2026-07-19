import { useEffect, useState } from 'react';
import { Skeleton } from '../../../shared/ui';

export function TripMedia({
  src,
  alt,
  loading = false,
  ratio = 'card',
  eager = false,
  tone = 'teal',
}: {
  src?: string;
  alt: string;
  loading?: boolean;
  ratio?: 'hero' | 'card';
  eager?: boolean;
  tone?: 'teal' | 'blue' | 'mist';
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <div className={`trip-media trip-media--${ratio} trip-media--${tone}`}>
      {loading ? (
        <Skeleton variant="block" className="trip-media__skeleton" />
      ) : src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="trip-media__fallback" aria-hidden="true">
          <span className="trip-media__sun" />
          <span className="trip-media__mountain trip-media__mountain--back" />
          <span className="trip-media__mountain trip-media__mountain--front" />
          <span className="trip-media__route" />
        </div>
      )}
    </div>
  );
}
