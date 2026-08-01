import { BlobReader, BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { normalizeMediaAssetContentHash } from '../../domain/media/mediaAssetContentHash.ts';
import type { MediaAsset, MediaAssetBlob } from '../../domain/models/scrapbook.ts';
import { AppError } from '../../shared/errors.ts';
import { webCryptoContentHasher, type ContentHasher } from '../media/contentHasher.ts';
import {
  FULL_BACKUP_MANIFEST_PATH,
  FULL_BACKUP_METADATA_PATH,
  FULL_BACKUP_PACKAGE_VERSION,
  createFullBackupMediaPath,
  validateFullBackupPackage,
  type FullBackupManifest,
  type FullBackupMediaEntry,
  type FullBackupMediaKind,
  type FullBackupPackageSummary,
  type FullBackupValidationResult,
} from './fullBackupPackage.ts';
import { BACKUP_SCHEMA_VERSION } from './backupSchema.ts';
import {
  buildBackupPayloadFromSnapshot,
  readBackupSnapshot,
  type BackupSnapshot,
} from './backupService.ts';

export type FullBackupProgressStage = 'snapshot' | 'hashing' | 'packaging' | 'validating' | 'ready';

export interface FullBackupProgress {
  stage: FullBackupProgressStage;
  completed: number;
  total: number;
}

export interface FullBackupEstimate {
  mediaAssetCount: number;
  availableBlobCount: number;
  missingBlobCount: number;
  availableByteSize: number;
}

export interface FullBackupBuildResult {
  blob: Blob;
  manifest: FullBackupManifest;
  validation: FullBackupValidationResult;
}

export interface FullBackupBuildOptions {
  signal?: AbortSignal;
  onProgress?: (progress: FullBackupProgress) => void;
  hasher?: ContentHasher;
  appVersion?: string;
  validatePackage?: typeof validateFullBackupPackage;
}

export class FullBackupBuildError extends AppError {
  readonly validation?: FullBackupValidationResult;

  constructor(message: string, cause?: unknown, validation?: FullBackupValidationResult) {
    super(message, cause);
    this.name = 'FullBackupBuildError';
    this.validation = validation;
  }
}

export async function estimateFullBackup(): Promise<FullBackupEstimate> {
  const snapshot = await readBackupSnapshot(true);
  return estimateFullBackupFromSnapshot(snapshot);
}

export function estimateFullBackupFromSnapshot(snapshot: BackupSnapshot): FullBackupEstimate {
  const metadata = buildBackupPayloadFromSnapshot(snapshot);
  const blobs = validBlobMap(snapshot.mediaAssetBlobs as MediaAssetBlob[] | undefined);
  const expectedIds = metadata.data.mediaAssets.flatMap((asset) => [
    `${asset.id}:original`,
    `${asset.id}:thumbnail`,
  ]);
  const available = expectedIds.map((id) => blobs.get(id)).filter((blob): blob is MediaAssetBlob => Boolean(blob));
  return {
    mediaAssetCount: metadata.data.mediaAssets.length,
    availableBlobCount: available.length,
    missingBlobCount: expectedIds.length - available.length,
    availableByteSize: available.reduce((total, item) => total + item.blob.size, 0),
  };
}

export async function buildFullBackupPackage(options: FullBackupBuildOptions = {}): Promise<FullBackupBuildResult> {
  options.onProgress?.({ stage: 'snapshot', completed: 0, total: 1 });
  assertNotAborted(options.signal);
  const snapshot = await readBackupSnapshot(true);
  assertNotAborted(options.signal);
  options.onProgress?.({ stage: 'snapshot', completed: 1, total: 1 });
  return buildFullBackupPackageFromSnapshot(snapshot, options);
}

export async function buildFullBackupPackageFromSnapshot(
  snapshot: BackupSnapshot,
  options: FullBackupBuildOptions = {},
): Promise<FullBackupBuildResult> {
  assertNotAborted(options.signal);
  const hasher = options.hasher ?? webCryptoContentHasher;
  const createdAt = new Date().toISOString();
  const metadata = buildBackupPayloadFromSnapshot(snapshot, createdAt);
  const blobs = validBlobMap(snapshot.mediaAssetBlobs as MediaAssetBlob[] | undefined);
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
  const mediaEntries: FullBackupMediaEntry[] = [];
  const totalMediaEntries = metadata.data.mediaAssets.length * 2;
  let completed = 0;

  try {
    for (const asset of metadata.data.mediaAssets) {
      for (const kind of ['original', 'thumbnail'] as const) {
        assertNotAborted(options.signal);
        const blobRecord = blobs.get(`${asset.id}:${kind}`);
        const mimeType = blobRecord?.mimeType || blobRecord?.blob.type || asset.mimeType;
        const path = createFullBackupMediaPath(asset.id, kind, mimeType);
        if (!blobRecord) {
          mediaEntries.push(createMissingEntry(asset, kind, path, mimeType));
          completed += 1;
          options.onProgress?.({ stage: 'hashing', completed, total: totalMediaEntries });
          continue;
        }

        options.onProgress?.({ stage: 'hashing', completed, total: totalMediaEntries });
        const checksum = await hasher.sha256(blobRecord.blob);
        assertNotAborted(options.signal);
        const entry: FullBackupMediaEntry = {
          assetId: asset.id,
          kind,
          path,
          mimeType,
          byteSize: blobRecord.blob.size,
          checksum,
          contentHash: kind === 'original' ? normalizeMediaAssetContentHash(asset.contentHash) : undefined,
          status: 'included',
        };
        mediaEntries.push(entry);
        options.onProgress?.({ stage: 'packaging', completed, total: totalMediaEntries });
        await zipWriter.add(path, new BlobReader(blobRecord.blob), {
          level: 0,
          signal: options.signal,
        });
        completed += 1;
        options.onProgress?.({ stage: 'packaging', completed, total: totalMediaEntries });
      }
    }

    assertNotAborted(options.signal);
    const metadataJson = JSON.stringify(metadata, null, 2);
    await zipWriter.add(FULL_BACKUP_METADATA_PATH, new TextReader(metadataJson), {
      level: 6,
      signal: options.signal,
    });
    const manifest = createManifest(metadata.data.mediaAssets, mediaEntries, createdAt, options.appVersion);
    await zipWriter.add(FULL_BACKUP_MANIFEST_PATH, new TextReader(JSON.stringify(manifest, null, 2)), {
      level: 6,
      signal: options.signal,
    });
    const zipBlob = await zipWriter.close();
    assertNotAborted(options.signal);

    options.onProgress?.({ stage: 'validating', completed: 0, total: 1 });
    const validation = await (options.validatePackage ?? validateFullBackupPackage)(zipBlob, hasher);
    assertNotAborted(options.signal);
    options.onProgress?.({ stage: 'validating', completed: 1, total: 1 });
    if (!validation.success) {
      throw new FullBackupBuildError('完全バックアップの自己検証に失敗しました。', undefined, validation);
    }
    options.onProgress?.({ stage: 'ready', completed: 1, total: 1 });
    return { blob: zipBlob, manifest, validation };
  } catch (error) {
    if (error instanceof FullBackupBuildError || isAbortError(error)) throw error;
    throw new FullBackupBuildError('完全バックアップを作成できませんでした。', error);
  }
}

function createMissingEntry(
  asset: MediaAsset,
  kind: FullBackupMediaKind,
  path: string,
  mimeType: string,
): FullBackupMediaEntry {
  return {
    assetId: asset.id,
    kind,
    path,
    mimeType,
    byteSize: 0,
    contentHash: kind === 'original' ? normalizeMediaAssetContentHash(asset.contentHash) : undefined,
    status: 'missing',
    missingReason: 'blob-not-found',
  };
}

function createManifest(
  assets: MediaAsset[],
  mediaEntries: FullBackupMediaEntry[],
  createdAt: string,
  appVersion?: string,
): FullBackupManifest {
  const included = mediaEntries.filter((entry) => entry.status === 'included');
  const summary: FullBackupPackageSummary = {
    mediaAssetCount: assets.length,
    mediaEntryCount: mediaEntries.length,
    includedCount: included.length,
    missingCount: mediaEntries.length - included.length,
    includedByteSize: included.reduce((total, entry) => total + entry.byteSize, 0),
    originalIncludedCount: included.filter((entry) => entry.kind === 'original').length,
    thumbnailIncludedCount: included.filter((entry) => entry.kind === 'thumbnail').length,
  };
  return {
    app: 'travel-log-pwa',
    packageVersion: FULL_BACKUP_PACKAGE_VERSION,
    createdAt,
    metadataSchemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    mediaEntries,
    summary,
    warnings: mediaEntries
      .filter((entry) => entry.status === 'missing')
      .map((entry) => ({ code: 'missing-media', assetId: entry.assetId, kind: entry.kind })),
  };
}

function validBlobMap(values: MediaAssetBlob[] | undefined): Map<string, MediaAssetBlob> {
  const result = new Map<string, MediaAssetBlob>();
  (values ?? []).forEach((value) => {
    if (value.id === `${value.assetId}:${value.kind}` && value.blob instanceof Blob) result.set(value.id, value);
  });
  return result;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Backup export cancelled', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
