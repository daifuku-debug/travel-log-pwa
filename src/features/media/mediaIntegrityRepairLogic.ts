import type {
  MediaIntegrityIssue,
  MediaIntegrityReport,
} from '../../domain/media/mediaIntegrity.ts';
import type { EntityId } from '../../domain/models/common.ts';
import type { MediaAsset, MediaAssetBlob } from '../../domain/models/scrapbook.ts';

export type MediaIntegrityRepairAction =
  | 'regenerate-thumbnail'
  | 'delete-cleanup-blobs'
  | 'delete-orphan-blob'
  | 'normalize-blob-reference';

export type MediaIntegrityRepairStatus = 'success' | 'skipped' | 'failed';

export type MediaIntegrityRepairCode =
  | 'repaired'
  | 'unsupported-issue'
  | 'stale-issue'
  | 'precondition-failed'
  | 'read-failed'
  | 'thumbnail-generation-failed'
  | 'blob-save-failed'
  | 'metadata-save-failed'
  | 'compensation-failed'
  | 'blob-delete-failed';

export interface MediaIntegrityRepairResult {
  issue: MediaIntegrityIssue;
  action?: MediaIntegrityRepairAction;
  status: MediaIntegrityRepairStatus;
  code: MediaIntegrityRepairCode;
  changedAssetIds: EntityId[];
  changedBlobIds: EntityId[];
  cause?: unknown;
}

export interface MediaIntegrityRepairBatchResult {
  results: MediaIntegrityRepairResult[];
  report?: MediaIntegrityReport;
  rescanStatus: 'success' | 'failed';
  rescanError?: unknown;
}

export interface MediaIntegrityRepairDependencies {
  getMediaAssetRaw: (id: EntityId) => Promise<MediaAsset | undefined>;
  listMediaAssetsRaw: () => Promise<MediaAsset[]>;
  saveMediaAssetRaw: (asset: MediaAsset) => Promise<MediaAsset>;
  getMediaAssetBlobRaw: (id: EntityId) => Promise<MediaAssetBlob | undefined>;
  saveMediaAssetBlobRaw: (blob: MediaAssetBlob) => Promise<MediaAssetBlob>;
  deleteMediaAssetBlobById: (id: EntityId) => Promise<void>;
  deleteMediaAssetBlobsByAssetId: (assetId: EntityId) => Promise<void>;
  createThumbnail: (blob: Blob, mimeType: string) => Promise<Blob>;
  scan: () => Promise<MediaIntegrityReport>;
  now?: () => string;
}

export function getMediaIntegrityRepairAction(
  issue: MediaIntegrityIssue,
): MediaIntegrityRepairAction | undefined {
  if (issue.type === 'missing-thumbnail') return 'regenerate-thumbnail';
  if (issue.type === 'cleanup-pending') return 'delete-cleanup-blobs';
  if (issue.type === 'orphan-blob' || issue.type === 'invalid-blob-id') return 'delete-orphan-blob';
  if (issue.type === 'invalid-blob-reference') return 'normalize-blob-reference';
  return undefined;
}

export function isDestructiveMediaIntegrityRepair(issue: MediaIntegrityIssue): boolean {
  const action = getMediaIntegrityRepairAction(issue);
  return action === 'delete-cleanup-blobs' || action === 'delete-orphan-blob';
}

export async function repairMediaIntegrityIssuesWithDependencies(
  issues: readonly MediaIntegrityIssue[],
  dependencies: MediaIntegrityRepairDependencies,
): Promise<MediaIntegrityRepairBatchResult> {
  const results: MediaIntegrityRepairResult[] = [];
  for (const issue of issues) {
    results.push(await repairMediaIntegrityIssueWithDependencies(issue, dependencies));
  }
  try {
    return { results, report: await dependencies.scan(), rescanStatus: 'success' };
  } catch (rescanError) {
    return { results, rescanStatus: 'failed', rescanError };
  }
}

export async function repairMediaIntegrityIssueWithDependencies(
  issue: MediaIntegrityIssue,
  dependencies: MediaIntegrityRepairDependencies,
): Promise<MediaIntegrityRepairResult> {
  const action = getMediaIntegrityRepairAction(issue);
  if (!action) return result(issue, undefined, 'skipped', 'unsupported-issue');
  try {
    if (action === 'regenerate-thumbnail') return await regenerateThumbnail(issue, dependencies);
    if (action === 'delete-cleanup-blobs') return await deleteCleanupBlobs(issue, dependencies);
    if (action === 'delete-orphan-blob') return await deleteOrphanBlob(issue, dependencies);
    return await normalizeBlobReference(issue, dependencies);
  } catch (cause) {
    return result(issue, action, 'failed', 'read-failed', [], [], cause);
  }
}

async function regenerateThumbnail(
  issue: MediaIntegrityIssue,
  dependencies: MediaIntegrityRepairDependencies,
): Promise<MediaIntegrityRepairResult> {
  const action = 'regenerate-thumbnail';
  if (!issue.assetId) return result(issue, action, 'skipped', 'stale-issue');
  const asset = await dependencies.getMediaAssetRaw(issue.assetId);
  if (!asset || asset.deletedAt || asset.storageType !== 'local') {
    return result(issue, action, 'skipped', 'stale-issue');
  }
  const originalId = `${asset.id}:original`;
  const thumbnailId = `${asset.id}:thumbnail`;
  const [original, existingThumbnail] = await Promise.all([
    dependencies.getMediaAssetBlobRaw(originalId),
    dependencies.getMediaAssetBlobRaw(thumbnailId),
  ]);
  if (existingThumbnail) return result(issue, action, 'skipped', 'stale-issue');
  if (!isExpectedBlob(original, asset.id, 'original')) {
    return result(issue, action, 'skipped', 'precondition-failed');
  }

  let thumbnail: Blob;
  try {
    thumbnail = await dependencies.createThumbnail(original.blob, original.mimeType || asset.mimeType);
  } catch (cause) {
    return result(issue, action, 'failed', 'thumbnail-generation-failed', [], [], cause);
  }
  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  try {
    await dependencies.saveMediaAssetBlobRaw({
      id: thumbnailId,
      assetId: asset.id,
      kind: 'thumbnail',
      blob: thumbnail,
      mimeType: thumbnail.type || asset.mimeType,
      createdAt: now,
    });
  } catch (cause) {
    return result(issue, action, 'failed', 'blob-save-failed', [], [], cause);
  }

  if (asset.thumbnailReference !== thumbnailId) {
    try {
      await dependencies.saveMediaAssetRaw({
        ...asset,
        thumbnailReference: thumbnailId,
        updatedAt: now,
        syncStatus: 'pending',
      });
    } catch (cause) {
      try {
        await dependencies.deleteMediaAssetBlobById(thumbnailId);
      } catch (compensationCause) {
        return result(issue, action, 'failed', 'compensation-failed', [], [thumbnailId], {
          cause,
          compensationCause,
        });
      }
      return result(issue, action, 'failed', 'metadata-save-failed', [], [], cause);
    }
  }
  return result(issue, action, 'success', 'repaired', [asset.id], [thumbnailId]);
}

async function deleteCleanupBlobs(
  issue: MediaIntegrityIssue,
  dependencies: MediaIntegrityRepairDependencies,
): Promise<MediaIntegrityRepairResult> {
  const action = 'delete-cleanup-blobs';
  if (!issue.assetId) return result(issue, action, 'skipped', 'stale-issue');
  const asset = await dependencies.getMediaAssetRaw(issue.assetId);
  if (!asset?.deletedAt) return result(issue, action, 'skipped', 'stale-issue');
  try {
    await dependencies.deleteMediaAssetBlobsByAssetId(asset.id);
  } catch (cause) {
    return result(issue, action, 'failed', 'blob-delete-failed', [], [], cause);
  }
  return result(issue, action, 'success', 'repaired', [], [
    `${asset.id}:original`,
    `${asset.id}:thumbnail`,
  ]);
}

async function deleteOrphanBlob(
  issue: MediaIntegrityIssue,
  dependencies: MediaIntegrityRepairDependencies,
): Promise<MediaIntegrityRepairResult> {
  const action = 'delete-orphan-blob';
  if (!issue.blobId) return result(issue, action, 'skipped', 'stale-issue');
  const blob = await dependencies.getMediaAssetBlobRaw(issue.blobId);
  if (!blob) return result(issue, action, 'skipped', 'stale-issue');

  if (issue.type === 'orphan-blob') {
    const asset = await dependencies.getMediaAssetRaw(blob.assetId);
    if (asset) return result(issue, action, 'skipped', 'stale-issue');
  } else {
    const assets = await dependencies.listMediaAssetsRaw();
    if (assets.some((asset) => !asset.deletedAt
      && (asset.localReference === blob.id || asset.thumbnailReference === blob.id))) {
      return result(issue, action, 'skipped', 'precondition-failed');
    }
  }
  try {
    await dependencies.deleteMediaAssetBlobById(blob.id);
  } catch (cause) {
    return result(issue, action, 'failed', 'blob-delete-failed', [], [], cause);
  }
  return result(issue, action, 'success', 'repaired', [], [blob.id]);
}

async function normalizeBlobReference(
  issue: MediaIntegrityIssue,
  dependencies: MediaIntegrityRepairDependencies,
): Promise<MediaIntegrityRepairResult> {
  const action = 'normalize-blob-reference';
  if (!issue.assetId || (issue.field !== 'localReference' && issue.field !== 'thumbnailReference')) {
    return result(issue, action, 'skipped', 'stale-issue');
  }
  const asset = await dependencies.getMediaAssetRaw(issue.assetId);
  if (!asset || asset.deletedAt) return result(issue, action, 'skipped', 'stale-issue');
  const kind = issue.field === 'localReference' ? 'original' : 'thumbnail';
  const expectedId = `${asset.id}:${kind}`;
  if (issue.expectedValue !== expectedId) return result(issue, action, 'skipped', 'stale-issue');
  if (asset[issue.field] === expectedId) return result(issue, action, 'skipped', 'stale-issue');
  if (asset[issue.field] !== issue.actualValue) return result(issue, action, 'skipped', 'stale-issue');
  const blob = await dependencies.getMediaAssetBlobRaw(expectedId);
  if (!isExpectedBlob(blob, asset.id, kind)) {
    return result(issue, action, 'skipped', 'precondition-failed');
  }
  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  try {
    await dependencies.saveMediaAssetRaw({
      ...asset,
      [issue.field]: expectedId,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (cause) {
    return result(issue, action, 'failed', 'metadata-save-failed', [], [], cause);
  }
  return result(issue, action, 'success', 'repaired', [asset.id], []);
}

function isExpectedBlob(
  blob: MediaAssetBlob | undefined,
  assetId: EntityId,
  kind: 'original' | 'thumbnail',
): blob is MediaAssetBlob {
  return Boolean(blob && blob.id === `${assetId}:${kind}` && blob.assetId === assetId && blob.kind === kind);
}

function result(
  issue: MediaIntegrityIssue,
  action: MediaIntegrityRepairAction | undefined,
  status: MediaIntegrityRepairStatus,
  code: MediaIntegrityRepairCode,
  changedAssetIds: EntityId[] = [],
  changedBlobIds: EntityId[] = [],
  cause?: unknown,
): MediaIntegrityRepairResult {
  return { issue, action, status, code, changedAssetIds, changedBlobIds, cause };
}
