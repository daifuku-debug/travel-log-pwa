import { normalizeMediaAssetContentHash } from '../../domain/media/mediaAssetContentHash.ts';
import { isCoverOnlyMediaAsset, isTripMediaAsset } from '../../domain/media/mediaAssetUsage.ts';
import type { EntityId } from '../../domain/models/common.ts';
import type { MediaAsset } from '../../domain/models/scrapbook.ts';
import type { MediaAssetBlobRepository, MediaAssetRepository } from '../../domain/repositories/ScrapbookRepository.ts';
import { webCryptoContentHasher, type ContentHasher } from './contentHasher.ts';

export interface ExactDuplicateFileInfo {
  fileSize: number;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface FindExactDuplicateMediaAssetsInput {
  tripId: EntityId;
  contentHash: string;
  fileInfo: ExactDuplicateFileInfo;
  scrapbookId?: EntityId;
}

export interface ExactDuplicateMatch {
  asset: MediaAsset;
  matchType: 'exact';
}

export interface ExactDuplicateDependencies {
  mediaAssets: MediaAssetRepository;
  mediaAssetBlobs: MediaAssetBlobRepository;
  contentHasher?: ContentHasher;
}

export async function findExactDuplicateMediaAssetsWithDependencies(
  input: FindExactDuplicateMediaAssetsInput,
  dependencies: ExactDuplicateDependencies,
): Promise<ExactDuplicateMatch[]> {
  const targetHash = normalizeMediaAssetContentHash(input.contentHash);
  if (!targetHash) return [];

  const assets = (await dependencies.mediaAssets.listByTripId(input.tripId))
    .filter((asset) => asset.tripId === input.tripId)
    .filter((asset) => !asset.deletedAt)
    .filter((asset) => isAvailableToCurrentEditor(asset, input.scrapbookId));
  const matches: MediaAsset[] = [];

  for (const asset of assets) {
    let contentHash = normalizeMediaAssetContentHash(asset.contentHash);
    if (!contentHash && canMatchFileInfo(asset, input.fileInfo)) {
      contentHash = await calculateAndStoreMissingHash(asset, dependencies);
    }
    if (contentHash === targetHash) matches.push(contentHash === asset.contentHash ? asset : { ...asset, contentHash });
  }

  return matches
    .sort(compareDuplicateCandidates)
    .map((asset) => ({ asset, matchType: 'exact' }));
}

function isAvailableToCurrentEditor(asset: MediaAsset, scrapbookId?: EntityId): boolean {
  if (isTripMediaAsset(asset)) return true;
  return Boolean(scrapbookId && isCoverOnlyMediaAsset(asset) && asset.ownerScrapbookId === scrapbookId);
}

function canMatchFileInfo(asset: MediaAsset, target: ExactDuplicateFileInfo): boolean {
  if (asset.fileSize !== undefined && asset.fileSize !== target.fileSize) return false;
  if (asset.width !== undefined && target.width !== undefined && asset.width !== target.width) return false;
  if (asset.height !== undefined && target.height !== undefined && asset.height !== target.height) return false;
  return true;
}

async function calculateAndStoreMissingHash(
  asset: MediaAsset,
  dependencies: ExactDuplicateDependencies,
): Promise<string | undefined> {
  if (!asset.localReference) return undefined;
  try {
    const original = await dependencies.mediaAssetBlobs.getById(asset.localReference);
    if (!original || original.kind !== 'original') return undefined;
    const contentHash = await (dependencies.contentHasher ?? webCryptoContentHasher).sha256(original.blob);
    const saved = await dependencies.mediaAssets.save({
      ...asset,
      contentHash,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
    return saved.contentHash;
  } catch {
    return undefined;
  }
}

function compareDuplicateCandidates(left: MediaAsset, right: MediaAsset): number {
  const usageDifference = Number(isCoverOnlyMediaAsset(left)) - Number(isCoverOnlyMediaAsset(right));
  return usageDifference || right.createdAt.localeCompare(left.createdAt);
}
