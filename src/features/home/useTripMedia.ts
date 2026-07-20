import { useEffect, useState } from 'react';
import {
  createMediaObjectUrl,
  getScrapbookByTripId,
} from '../scrapbooks/scrapbookService';
import { resolveScrapbookCoverPhotoId } from '../scrapbooks/scrapbookCoverLogic';

export type TripMediaLoadState =
  | { status: 'loading' }
  | { status: 'ready'; src: string }
  | { status: 'empty' }
  | { status: 'error' };

export function useTripMedia(tripIds: string[]): Record<string, TripMediaLoadState> {
  const key = [...new Set(tripIds)].join('|');
  const [mediaByTripId, setMediaByTripId] = useState<Record<string, TripMediaLoadState>>({});

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    let active = true;
    const objectUrls = new Set<string>();

    setMediaByTripId(Object.fromEntries(ids.map((id) => [id, { status: 'loading' }])));

    void Promise.all(ids.map(async (tripId) => {
      try {
        const detail = await getScrapbookByTripId(tripId);
        const preferredId = detail
          ? resolveScrapbookCoverPhotoId(detail.scrapbook, detail.pages, detail.mediaAssets.map((asset) => asset.id))
          : undefined;
        const asset = detail?.mediaAssets.find((candidate) => candidate.id === preferredId);
        if (!asset) return [tripId, { status: 'empty' } satisfies TripMediaLoadState] as const;

        const src = await createMediaObjectUrl(asset, 'thumbnail');
        if (!src) return [tripId, { status: 'empty' } satisfies TripMediaLoadState] as const;
        if (!active) {
          URL.revokeObjectURL(src);
          return [tripId, { status: 'empty' } satisfies TripMediaLoadState] as const;
        }
        objectUrls.add(src);
        return [tripId, { status: 'ready', src } satisfies TripMediaLoadState] as const;
      } catch {
        return [tripId, { status: 'error' } satisfies TripMediaLoadState] as const;
      }
    })).then((entries) => {
      if (active) setMediaByTripId(Object.fromEntries(entries));
    });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [key]);

  return mediaByTripId;
}
