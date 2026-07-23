import type { EntityId } from '../models/common';
import type { MediaAsset, MediaAssetUsage } from '../models/scrapbook';

export function normalizeMediaAssetUsage(value: unknown): MediaAssetUsage {
  return value === 'cover-only' ? 'cover-only' : 'trip';
}

export function normalizeMediaAssetOwnership(asset: MediaAsset): MediaAsset {
  const usage = normalizeMediaAssetUsage(asset.usage);
  const ownerScrapbookId = normalizeEntityId(asset.ownerScrapbookId);

  if (usage === 'cover-only' && ownerScrapbookId) {
    return { ...asset, usage, ownerScrapbookId };
  }

  const { ownerScrapbookId: _ownerScrapbookId, ...rest } = asset;
  return { ...rest, usage: 'trip' };
}

export function isTripMediaAsset(asset: MediaAsset): boolean {
  return normalizeMediaAssetOwnership(asset).usage === 'trip';
}

export function isCoverOnlyMediaAsset(asset: MediaAsset): boolean {
  return normalizeMediaAssetOwnership(asset).usage === 'cover-only';
}

export function isCoverAssetAvailableToScrapbook(asset: MediaAsset, scrapbookId: EntityId): boolean {
  const normalized = normalizeMediaAssetOwnership(asset);
  return normalized.usage === 'trip' || normalized.ownerScrapbookId === scrapbookId;
}

export function filterTripMediaAssets(assets: readonly MediaAsset[]): MediaAsset[] {
  return assets.filter(isTripMediaAsset);
}

export function filterCoverAssetsForScrapbook(
  assets: readonly MediaAsset[],
  scrapbookId: EntityId,
): MediaAsset[] {
  return assets.filter((asset) => isCoverAssetAvailableToScrapbook(asset, scrapbookId));
}

function normalizeEntityId(value: unknown): EntityId | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
