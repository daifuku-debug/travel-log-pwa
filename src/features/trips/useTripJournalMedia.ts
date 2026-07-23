import { useEffect, useState } from 'react';
import type { ScrapbookBlock } from '../../domain/models/scrapbook';
import { filterTripMediaAssets } from '../../domain/media/mediaAssetUsage';
import { resolveScrapbookCoverPhotoId } from '../scrapbooks/scrapbookCoverLogic';
import { createMediaObjectUrl, getScrapbookByTripId } from '../scrapbooks/scrapbookService';

export interface TripJournalMediaState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  coverSource?: string;
  sources: string[];
  highlights: string[];
  photoCount: number;
}

const EMPTY_STATE: TripJournalMediaState = {
  status: 'empty',
  sources: [],
  highlights: [],
  photoCount: 0,
};

export function useTripJournalMedia(tripId?: string): TripJournalMediaState {
  const [state, setState] = useState<TripJournalMediaState>(tripId ? { ...EMPTY_STATE, status: 'loading' } : EMPTY_STATE);

  useEffect(() => {
    if (!tripId) {
      setState(EMPTY_STATE);
      return;
    }

    let active = true;
    const objectUrls = new Set<string>();
    setState({ ...EMPTY_STATE, status: 'loading' });

    void getScrapbookByTripId(tripId)
      .then(async (detail) => {
        if (!detail) return EMPTY_STATE;
        const tripMediaAssets = filterTripMediaAssets(detail.mediaAssets);
        const preferredId = resolveScrapbookCoverPhotoId(
          detail.scrapbook,
          detail.pages,
          detail.mediaAssets.map((asset) => asset.id),
        );
        const preferred = detail.mediaAssets.find((asset) => asset.id === preferredId);
        const galleryAssets = tripMediaAssets.slice(0, 4);
        const imageAssets = [preferred, ...galleryAssets]
          .filter((asset, index, items) => asset && items.findIndex((candidate) => candidate?.id === asset.id) === index);
        const sourceByAssetId = new Map((await Promise.all(imageAssets.map(async (asset) => {
          if (!asset) return undefined;
          const source = await createMediaObjectUrl(asset, 'thumbnail');
          if (source) objectUrls.add(source);
          return source ? [asset.id, source] as const : undefined;
        }))).filter((entry): entry is readonly [string, string] => Boolean(entry)));
        const coverSource = preferred ? sourceByAssetId.get(preferred.id) : undefined;
        const sources = galleryAssets
          .map((asset) => sourceByAssetId.get(asset.id))
          .filter((source): source is string => Boolean(source));
        return {
          status: coverSource || sources.length > 0 ? 'ready' : 'empty',
          coverSource,
          sources,
          highlights: detail.pages.flatMap((page) => page.blocks).map(blockText).filter(Boolean).slice(0, 3),
          photoCount: tripMediaAssets.length,
        } satisfies TripJournalMediaState;
      })
      .then((nextState) => {
        if (active) setState(nextState);
        else objectUrls.forEach((url) => URL.revokeObjectURL(url));
      })
      .catch(() => {
        if (active) setState({ ...EMPTY_STATE, status: 'error' });
      });

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [tripId]);

  return state;
}

function blockText(block: ScrapbookBlock): string {
  if (block.type === 'text') return block.text || block.note || '';
  if (block.type === 'quote') return block.text;
  if (block.type === 'trip_summary') return block.body || block.title || '';
  if (block.type === 'photo') return block.body || block.caption || block.note || '';
  if (block.type === 'photo_grid') return block.body || block.caption || block.note || '';
  if (block.type === 'place') return block.body || block.caption || block.note || '';
  if (block.type === 'meal') return block.body || block.note || '';
  if (block.type === 'ticket') return block.body || block.note || '';
  if (block.type === 'purchase') return block.body || block.note || '';
  return '';
}
