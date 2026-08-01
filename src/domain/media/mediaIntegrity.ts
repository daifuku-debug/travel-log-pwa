import { normalizeMediaAssetContentHash } from './mediaAssetContentHash.ts';
import {
  collectBlockMediaAssetReferenceEntries,
  collectScrapbookMediaAssetReferenceEntries,
  type MediaAssetReferenceField,
  type PersistentMediaAssetReferenceEntry,
} from './mediaAssetReferences.ts';
import type { EntityId } from '../models/common.ts';
import type {
  MediaAsset,
  MediaAssetBlob,
  Scrapbook,
  ScrapbookBlock,
  ScrapbookPage,
} from '../models/scrapbook.ts';

export const MEDIA_INTEGRITY_ISSUE_TYPES = [
  'orphan-blob',
  'invalid-blob-id',
  'missing-original',
  'missing-thumbnail',
  'cleanup-pending',
  'invalid-blob-reference',
  'invalid-content-hash',
  'invalid-cover-owner',
  'dangling-reference',
  'stale-reference-source',
] as const;

export type MediaIntegrityIssueType = typeof MEDIA_INTEGRITY_ISSUE_TYPES[number];
export type MediaIntegritySeverity = 'warning' | 'error';
export type MediaIntegrityRepairability = 'manual' | 'repair-candidate';

export type MediaIntegrityIssueReason =
  | 'metadata-missing'
  | 'metadata-deleted'
  | 'invalid-format'
  | 'reference-mismatch'
  | 'invalid-hash-format'
  | 'owner-missing'
  | 'owner-not-found'
  | 'owner-deleted'
  | 'trip-mismatch'
  | 'scrapbook-deleted'
  | 'scrapbook-missing'
  | 'page-deleted'
  | 'page-missing'
  | 'block-deleted';

export interface MediaIntegrityIssue {
  type: MediaIntegrityIssueType;
  severity: MediaIntegritySeverity;
  repairability: MediaIntegrityRepairability;
  reason: MediaIntegrityIssueReason;
  assetId?: EntityId;
  blobId?: EntityId;
  tripId?: EntityId;
  scrapbookId?: EntityId;
  pageId?: EntityId;
  blockId?: EntityId;
  field?: MediaAssetReferenceField | 'localReference' | 'thumbnailReference' | 'contentHash' | 'ownerScrapbookId';
  occurrenceIndex?: number;
  expectedValue?: string;
  actualValue?: string;
}

export interface MediaIntegritySnapshot {
  mediaAssets: MediaAsset[];
  mediaAssetBlobs: MediaAssetBlob[];
  scrapbooks: Scrapbook[];
  scrapbookPages: ScrapbookPage[];
  scrapbookBlocks: ScrapbookBlock[];
}

export interface MediaIntegritySummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  affectedAssetCount: number;
  affectedBlobCount: number;
  byType: Record<MediaIntegrityIssueType, number>;
}

export interface MediaIntegrityReport {
  status: 'success';
  scannedAt: string;
  issues: MediaIntegrityIssue[];
  summary: MediaIntegritySummary;
  scanned: {
    mediaAssets: number;
    mediaAssetBlobs: number;
    scrapbooks: number;
    scrapbookPages: number;
    scrapbookBlocks: number;
  };
}

export function buildMediaIntegrityReport(
  snapshot: MediaIntegritySnapshot,
  scannedAt: string,
): MediaIntegrityReport {
  const issues: MediaIntegrityIssue[] = [];
  const assetsById = new Map(snapshot.mediaAssets.map((asset) => [asset.id, asset]));
  const scrapbooksById = new Map(snapshot.scrapbooks.map((scrapbook) => [scrapbook.id, scrapbook]));
  const pagesById = new Map(snapshot.scrapbookPages.map((page) => [page.id, page]));
  const validBlobIds = new Set<EntityId>();

  for (const blob of snapshot.mediaAssetBlobs) {
    if (!isValidBlobIdentity(blob)) {
      issues.push(createIssue('invalid-blob-id', 'error', 'manual', 'invalid-format', {
        assetId: validEntityId(blob.assetId),
        blobId: validEntityId(blob.id),
      }));
      continue;
    }
    validBlobIds.add(blob.id);
    const asset = assetsById.get(blob.assetId);
    if (!asset) {
      issues.push(createIssue('orphan-blob', 'warning', 'repair-candidate', 'metadata-missing', {
        assetId: blob.assetId,
        blobId: blob.id,
      }));
    } else if (asset.deletedAt) {
      issues.push(createIssue('cleanup-pending', 'warning', 'repair-candidate', 'metadata-deleted', {
        assetId: blob.assetId,
        blobId: blob.id,
        tripId: asset.tripId,
      }));
    }
  }

  for (const asset of snapshot.mediaAssets) {
    if (asset.deletedAt) continue;
    validateAssetBlobs(asset, validBlobIds, issues);
    validateContentHash(asset, issues);
    validateCoverOwner(asset, scrapbooksById, issues);
  }

  for (const scrapbook of snapshot.scrapbooks) {
    for (const entry of collectScrapbookMediaAssetReferenceEntries(scrapbook)) {
      collectReferenceIssues(issues, entry, assetsById, {
        tripId: scrapbook.tripId,
        scrapbookId: scrapbook.id,
        sourceReason: scrapbook.deletedAt ? 'scrapbook-deleted' : undefined,
      });
    }
  }

  for (const block of snapshot.scrapbookBlocks) {
    const page = pagesById.get(block.pageId);
    const scrapbook = page ? scrapbooksById.get(page.scrapbookId) : undefined;
    const sourceReason = block.deletedAt
      ? 'block-deleted'
      : !page
        ? 'page-missing'
        : page.deletedAt
          ? 'page-deleted'
          : !scrapbook
            ? 'scrapbook-missing'
            : scrapbook.deletedAt
              ? 'scrapbook-deleted'
              : undefined;
    for (const entry of collectBlockMediaAssetReferenceEntries(block)) {
      collectReferenceIssues(issues, entry, assetsById, {
        tripId: scrapbook?.tripId ?? assetsById.get(entry.assetId)?.tripId,
        scrapbookId: scrapbook?.id ?? page?.scrapbookId,
        pageId: block.pageId,
        blockId: block.id,
        sourceReason,
      });
    }
  }

  const sortedIssues = sortMediaIntegrityIssues(issues);
  return {
    status: 'success',
    scannedAt,
    issues: sortedIssues,
    summary: summarizeMediaIntegrityIssues(sortedIssues),
    scanned: {
      mediaAssets: snapshot.mediaAssets.length,
      mediaAssetBlobs: snapshot.mediaAssetBlobs.length,
      scrapbooks: snapshot.scrapbooks.length,
      scrapbookPages: snapshot.scrapbookPages.length,
      scrapbookBlocks: snapshot.scrapbookBlocks.length,
    },
  };
}

export function sortMediaIntegrityIssues(issues: MediaIntegrityIssue[]): MediaIntegrityIssue[] {
  return issues.slice().sort((left, right) => compareTuple([
    MEDIA_INTEGRITY_ISSUE_TYPES.indexOf(left.type),
    left.tripId ?? '',
    left.assetId ?? '',
    left.blobId ?? '',
    left.scrapbookId ?? '',
    left.pageId ?? '',
    left.blockId ?? '',
    left.field ?? '',
    left.occurrenceIndex ?? -1,
  ], [
    MEDIA_INTEGRITY_ISSUE_TYPES.indexOf(right.type),
    right.tripId ?? '',
    right.assetId ?? '',
    right.blobId ?? '',
    right.scrapbookId ?? '',
    right.pageId ?? '',
    right.blockId ?? '',
    right.field ?? '',
    right.occurrenceIndex ?? -1,
  ]));
}

export function summarizeMediaIntegrityIssues(issues: MediaIntegrityIssue[]): MediaIntegritySummary {
  const byType = Object.fromEntries(MEDIA_INTEGRITY_ISSUE_TYPES.map((type) => [type, 0])) as Record<MediaIntegrityIssueType, number>;
  for (const issue of issues) byType[issue.type] += 1;
  return {
    totalIssues: issues.length,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    affectedAssetCount: new Set(issues.flatMap((issue) => issue.assetId ? [issue.assetId] : [])).size,
    affectedBlobCount: new Set(issues.flatMap((issue) => issue.blobId ? [issue.blobId] : [])).size,
    byType,
  };
}

function validateAssetBlobs(
  asset: MediaAsset,
  validBlobIds: ReadonlySet<EntityId>,
  issues: MediaIntegrityIssue[],
) {
  if (asset.storageType !== 'local') return;
  const originalId = `${asset.id}:original`;
  const thumbnailId = `${asset.id}:thumbnail`;
  if (!validBlobIds.has(originalId)) {
    issues.push(createIssue('missing-original', 'error', 'manual', 'metadata-missing', {
      assetId: asset.id, blobId: originalId, tripId: asset.tripId,
    }));
  }
  if (!validBlobIds.has(thumbnailId)) {
    issues.push(createIssue('missing-thumbnail', 'warning', 'repair-candidate', 'metadata-missing', {
      assetId: asset.id, blobId: thumbnailId, tripId: asset.tripId,
    }));
  }
  if (asset.localReference !== originalId) {
    issues.push(createIssue('invalid-blob-reference', 'error', 'manual', 'reference-mismatch', {
      assetId: asset.id,
      tripId: asset.tripId,
      field: 'localReference',
      expectedValue: originalId,
      actualValue: asset.localReference,
    }));
  }
  if (asset.thumbnailReference !== thumbnailId) {
    issues.push(createIssue('invalid-blob-reference', 'warning', 'manual', 'reference-mismatch', {
      assetId: asset.id,
      tripId: asset.tripId,
      field: 'thumbnailReference',
      expectedValue: thumbnailId,
      actualValue: asset.thumbnailReference,
    }));
  }
}

function validateContentHash(asset: MediaAsset, issues: MediaIntegrityIssue[]) {
  const rawHash = (asset as MediaAsset & { contentHash?: unknown }).contentHash;
  if (rawHash === undefined) return;
  if (normalizeMediaAssetContentHash(rawHash) !== rawHash) {
    issues.push(createIssue('invalid-content-hash', 'warning', 'manual', 'invalid-hash-format', {
      assetId: asset.id,
      tripId: asset.tripId,
      field: 'contentHash',
      actualValue: typeof rawHash === 'string' ? rawHash : undefined,
    }));
  }
}

function validateCoverOwner(
  asset: MediaAsset,
  scrapbooksById: ReadonlyMap<EntityId, Scrapbook>,
  issues: MediaIntegrityIssue[],
) {
  const rawUsage = (asset as MediaAsset & { usage?: unknown }).usage;
  if (rawUsage !== 'cover-only') return;
  const ownerId = validEntityId((asset as MediaAsset & { ownerScrapbookId?: unknown }).ownerScrapbookId);
  if (!ownerId) {
    issues.push(createIssue('invalid-cover-owner', 'error', 'manual', 'owner-missing', {
      assetId: asset.id, tripId: asset.tripId, field: 'ownerScrapbookId',
    }));
    return;
  }
  const owner = scrapbooksById.get(ownerId);
  if (!owner) {
    issues.push(createIssue('invalid-cover-owner', 'error', 'manual', 'owner-not-found', {
      assetId: asset.id, tripId: asset.tripId, scrapbookId: ownerId, field: 'ownerScrapbookId',
    }));
  } else if (owner.deletedAt) {
    issues.push(createIssue('invalid-cover-owner', 'error', 'manual', 'owner-deleted', {
      assetId: asset.id, tripId: asset.tripId, scrapbookId: ownerId, field: 'ownerScrapbookId',
    }));
  } else if (owner.tripId !== asset.tripId) {
    issues.push(createIssue('invalid-cover-owner', 'error', 'manual', 'trip-mismatch', {
      assetId: asset.id, tripId: asset.tripId, scrapbookId: ownerId, field: 'ownerScrapbookId',
      expectedValue: asset.tripId, actualValue: owner.tripId,
    }));
  }
}

function collectReferenceIssues(
  issues: MediaIntegrityIssue[],
  entry: PersistentMediaAssetReferenceEntry,
  assetsById: ReadonlyMap<EntityId, MediaAsset>,
  context: {
    tripId?: EntityId;
    scrapbookId?: EntityId;
    pageId?: EntityId;
    blockId?: EntityId;
    sourceReason?: Extract<MediaIntegrityIssueReason,
      'scrapbook-deleted' | 'scrapbook-missing' | 'page-deleted' | 'page-missing' | 'block-deleted'>;
  },
) {
  const location = {
    assetId: entry.assetId,
    tripId: context.tripId,
    scrapbookId: context.scrapbookId,
    pageId: context.pageId,
    blockId: context.blockId,
    field: entry.field,
    occurrenceIndex: entry.occurrenceIndex,
  };
  if (context.sourceReason) {
    issues.push(createIssue('stale-reference-source', 'warning', 'manual', context.sourceReason, location));
  }
  const asset = assetsById.get(entry.assetId);
  if (!asset) {
    issues.push(createIssue('dangling-reference', 'error', 'manual', 'metadata-missing', location));
  } else if (asset.deletedAt) {
    issues.push(createIssue('dangling-reference', 'error', 'manual', 'metadata-deleted', {
      ...location,
      tripId: context.tripId ?? asset.tripId,
    }));
  }
}

function createIssue(
  type: MediaIntegrityIssueType,
  severity: MediaIntegritySeverity,
  repairability: MediaIntegrityRepairability,
  reason: MediaIntegrityIssueReason,
  values: Omit<MediaIntegrityIssue, 'type' | 'severity' | 'repairability' | 'reason'>,
): MediaIntegrityIssue {
  return { type, severity, repairability, reason, ...values };
}

function isValidBlobIdentity(blob: MediaAssetBlob): boolean {
  const kind = (blob as MediaAssetBlob & { kind?: unknown }).kind;
  const assetId = validEntityId((blob as MediaAssetBlob & { assetId?: unknown }).assetId);
  const blobId = validEntityId((blob as MediaAssetBlob & { id?: unknown }).id);
  return Boolean(assetId && blobId && (kind === 'original' || kind === 'thumbnail') && blobId === `${assetId}:${kind}`);
}

function validEntityId(value: unknown): EntityId | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function compareTuple(left: Array<string | number>, right: Array<string | number>): number {
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    const difference = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    if (difference) return difference;
  }
  return 0;
}
