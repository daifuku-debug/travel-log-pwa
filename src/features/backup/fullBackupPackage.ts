import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry } from '@zip.js/zip.js';
import { normalizeMediaAssetContentHash } from '../../domain/media/mediaAssetContentHash.ts';
import type { EntityId } from '../../domain/models/common.ts';
import type { ContentHasher } from '../media/contentHasher.ts';
import { webCryptoContentHasher } from '../media/contentHasher.ts';
import { BACKUP_SCHEMA_VERSION, normalizeBackupPayload, type TravelLogBackup } from './backupSchema.ts';

export const FULL_BACKUP_PACKAGE_VERSION = 1;
export const FULL_BACKUP_MANIFEST_PATH = 'manifest.json';
export const FULL_BACKUP_METADATA_PATH = 'metadata.json';

export type FullBackupMediaKind = 'original' | 'thumbnail';
export type FullBackupMediaStatus = 'included' | 'missing';

export interface FullBackupMediaEntry {
  assetId: EntityId;
  kind: FullBackupMediaKind;
  path: string;
  mimeType: string;
  byteSize: number;
  checksum?: string;
  contentHash?: string;
  status: FullBackupMediaStatus;
  missingReason?: string;
}

export interface FullBackupPackageSummary {
  mediaAssetCount: number;
  mediaEntryCount: number;
  includedCount: number;
  missingCount: number;
  includedByteSize: number;
  originalIncludedCount: number;
  thumbnailIncludedCount: number;
}

export interface FullBackupPackageWarning {
  code: 'missing-media';
  assetId: EntityId;
  kind: FullBackupMediaKind;
}

export interface FullBackupManifest {
  app: 'travel-log-pwa';
  packageVersion: number;
  createdAt: string;
  metadataSchemaVersion: number;
  appVersion?: string;
  mediaEntries: FullBackupMediaEntry[];
  summary: FullBackupPackageSummary;
  warnings: FullBackupPackageWarning[];
}

export type FullBackupValidationIssueCode =
  | 'zip-read-failed'
  | 'manifest-missing'
  | 'metadata-missing'
  | 'duplicate-path'
  | 'unsafe-path'
  | 'manifest-invalid'
  | 'package-version-unsupported'
  | 'metadata-schema-unsupported'
  | 'metadata-invalid'
  | 'duplicate-media-entry'
  | 'included-file-missing'
  | 'missing-file-present'
  | 'unexpected-file'
  | 'byte-size-mismatch'
  | 'mime-type-mismatch'
  | 'checksum-invalid'
  | 'checksum-mismatch'
  | 'summary-mismatch';

export interface FullBackupValidationIssue {
  code: FullBackupValidationIssueCode;
  path?: string;
  assetId?: EntityId;
  kind?: FullBackupMediaKind;
}

export interface FullBackupValidationResult {
  success: boolean;
  warnings: FullBackupValidationIssue[];
  errors: FullBackupValidationIssue[];
  manifest?: FullBackupManifest;
  metadata?: TravelLogBackup;
}

export function createFullBackupMediaPath(assetId: EntityId, kind: FullBackupMediaKind, mimeType: string): string {
  return `media/${encodeURIComponent(assetId)}/${kind}.${extensionForMimeType(mimeType)}`;
}

export function isSafeBackupPath(path: string): boolean {
  if (!path || path.includes('\\') || path.includes('\0') || path.startsWith('/')) return false;
  const segments = path.split('/');
  return segments.every((segment) => Boolean(segment) && segment !== '.' && segment !== '..');
}

export function findDuplicateBackupPaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  paths.forEach((path) => {
    if (seen.has(path)) duplicates.add(path);
    seen.add(path);
  });
  return [...duplicates].sort();
}

export async function validateFullBackupPackage(
  zipBlob: Blob,
  hasher: ContentHasher = webCryptoContentHasher,
): Promise<FullBackupValidationResult> {
  const errors: FullBackupValidationIssue[] = [];
  const warnings: FullBackupValidationIssue[] = [];
  let reader: ZipReader<Blob> | undefined;

  try {
    reader = new ZipReader(new BlobReader(zipBlob));
    const entries = await reader.getEntries();
    const files = entries.filter((entry) => !entry.directory);
    const entriesByPath = new Map<string, Entry[]>();
    files.forEach((entry) => {
      const matches = entriesByPath.get(entry.filename) ?? [];
      matches.push(entry);
      entriesByPath.set(entry.filename, matches);
      if (!isSafeBackupPath(entry.filename)) errors.push({ code: 'unsafe-path', path: entry.filename });
    });
    findDuplicateBackupPaths(files.map((entry) => entry.filename))
      .forEach((path) => errors.push({ code: 'duplicate-path', path }));

    const manifestEntry = singleFileEntry(entriesByPath, FULL_BACKUP_MANIFEST_PATH);
    const metadataEntry = singleFileEntry(entriesByPath, FULL_BACKUP_METADATA_PATH);
    if (!manifestEntry) errors.push({ code: 'manifest-missing', path: FULL_BACKUP_MANIFEST_PATH });
    if (!metadataEntry) errors.push({ code: 'metadata-missing', path: FULL_BACKUP_METADATA_PATH });
    if (!manifestEntry || !metadataEntry || errors.some((issue) => issue.code === 'duplicate-path')) {
      return { success: false, warnings, errors };
    }

    const manifest = parseManifest(await manifestEntry.getData(new TextWriter(), { checkSignature: true }), errors);
    if (!manifest) return { success: false, warnings, errors };
    if (manifest.packageVersion !== FULL_BACKUP_PACKAGE_VERSION) {
      errors.push({ code: 'package-version-unsupported', path: FULL_BACKUP_MANIFEST_PATH });
    }
    if (manifest.metadataSchemaVersion !== BACKUP_SCHEMA_VERSION) {
      errors.push({ code: 'metadata-schema-unsupported', path: FULL_BACKUP_METADATA_PATH });
    }

    let metadata: TravelLogBackup | undefined;
    try {
      const rawMetadata = JSON.parse(await metadataEntry.getData(new TextWriter(), { checkSignature: true })) as unknown;
      if (!isRecord(rawMetadata) || rawMetadata.schemaVersion !== BACKUP_SCHEMA_VERSION) {
        errors.push({ code: 'metadata-schema-unsupported', path: FULL_BACKUP_METADATA_PATH });
      } else {
        metadata = normalizeBackupPayload(rawMetadata);
      }
    } catch {
      errors.push({ code: 'metadata-invalid', path: FULL_BACKUP_METADATA_PATH });
    }

    const mediaKeys = new Set<string>();
    const declaredPaths = new Set([FULL_BACKUP_MANIFEST_PATH, FULL_BACKUP_METADATA_PATH]);
    for (const mediaEntry of manifest.mediaEntries) {
      const key = `${mediaEntry.assetId}:${mediaEntry.kind}`;
      if (mediaKeys.has(key)) {
        errors.push({ code: 'duplicate-media-entry', assetId: mediaEntry.assetId, kind: mediaEntry.kind });
      }
      mediaKeys.add(key);
      declaredPaths.add(mediaEntry.path);
      if (!isSafeBackupPath(mediaEntry.path)
        || mediaEntry.path !== createFullBackupMediaPath(mediaEntry.assetId, mediaEntry.kind, mediaEntry.mimeType)) {
        errors.push({ code: 'unsafe-path', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
        continue;
      }

      const zipEntry = singleFileEntry(entriesByPath, mediaEntry.path);
      if (mediaEntry.status === 'missing') {
        if (zipEntry) errors.push({ code: 'missing-file-present', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
        warnings.push({ code: 'included-file-missing', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
        continue;
      }
      if (!zipEntry) {
        errors.push({ code: 'included-file-missing', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
        continue;
      }
      const normalizedChecksum = normalizeMediaAssetContentHash(mediaEntry.checksum);
      if (!normalizedChecksum || normalizedChecksum !== mediaEntry.checksum) {
        errors.push({ code: 'checksum-invalid', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
        continue;
      }
      const mediaBlob = await zipEntry.getData(new BlobWriter(mediaEntry.mimeType), { checkSignature: true });
      if (mediaBlob.size !== mediaEntry.byteSize || zipEntry.uncompressedSize !== mediaEntry.byteSize) {
        errors.push({ code: 'byte-size-mismatch', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
      }
      if (await detectImageMimeType(mediaBlob) !== mediaEntry.mimeType) {
        errors.push({ code: 'mime-type-mismatch', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
      }
      if (await hasher.sha256(mediaBlob) !== normalizedChecksum) {
        errors.push({ code: 'checksum-mismatch', path: mediaEntry.path, assetId: mediaEntry.assetId, kind: mediaEntry.kind });
      }
    }

    entriesByPath.forEach((_, path) => {
      if (!declaredPaths.has(path)) errors.push({ code: 'unexpected-file', path });
    });
    if (!summaryMatches(manifest)) errors.push({ code: 'summary-mismatch', path: FULL_BACKUP_MANIFEST_PATH });
    if (metadata && metadata.data.mediaAssets.length !== manifest.summary.mediaAssetCount) {
      errors.push({ code: 'summary-mismatch', path: FULL_BACKUP_METADATA_PATH });
    }

    return { success: errors.length === 0, warnings, errors, manifest, metadata };
  } catch {
    errors.push({ code: 'zip-read-failed' });
    return { success: false, warnings, errors };
  } finally {
    await reader?.close().catch(() => undefined);
  }
}

function singleFileEntry(entries: Map<string, Entry[]>, path: string) {
  const matches = entries.get(path);
  const entry = matches?.length === 1 ? matches[0] : undefined;
  return entry && !entry.directory ? entry : undefined;
}

function parseManifest(value: string, errors: FullBackupValidationIssue[]): FullBackupManifest | undefined {
  try {
    const manifest = JSON.parse(value) as unknown;
    if (!isRecord(manifest)
      || manifest.app !== 'travel-log-pwa'
      || !Number.isSafeInteger(manifest.packageVersion)
      || typeof manifest.createdAt !== 'string' || Number.isNaN(Date.parse(manifest.createdAt))
      || !Number.isSafeInteger(manifest.metadataSchemaVersion)
      || !Array.isArray(manifest.mediaEntries)
      || !isSummary(manifest.summary)
      || !Array.isArray(manifest.warnings)
      || !manifest.mediaEntries.every(isMediaEntry)
      || !manifest.warnings.every(isWarning)) {
      errors.push({ code: 'manifest-invalid', path: FULL_BACKUP_MANIFEST_PATH });
      return undefined;
    }
    return manifest as unknown as FullBackupManifest;
  } catch {
    errors.push({ code: 'manifest-invalid', path: FULL_BACKUP_MANIFEST_PATH });
    return undefined;
  }
}

function isMediaEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.assetId !== 'string' || !value.assetId
    || !['original', 'thumbnail'].includes(String(value.kind))
    || typeof value.path !== 'string'
    || typeof value.mimeType !== 'string' || !value.mimeType.startsWith('image/')
    || !Number.isSafeInteger(value.byteSize) || Number(value.byteSize) < 0
    || !['included', 'missing'].includes(String(value.status))) return false;
  if (value.contentHash !== undefined && normalizeMediaAssetContentHash(value.contentHash) !== value.contentHash) return false;
  if (value.status === 'included') return typeof value.checksum === 'string';
  return typeof value.missingReason === 'string' && !value.checksum;
}

function isSummary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return [
    'mediaAssetCount',
    'mediaEntryCount',
    'includedCount',
    'missingCount',
    'includedByteSize',
    'originalIncludedCount',
    'thumbnailIncludedCount',
  ].every((key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0);
}

function isWarning(value: unknown): boolean {
  return isRecord(value)
    && value.code === 'missing-media'
    && typeof value.assetId === 'string'
    && ['original', 'thumbnail'].includes(String(value.kind));
}

function summaryMatches(manifest: FullBackupManifest): boolean {
  const included = manifest.mediaEntries.filter((entry) => entry.status === 'included');
  const summary = manifest.summary;
  return summary.mediaEntryCount === manifest.mediaEntries.length
    && summary.includedCount === included.length
    && summary.missingCount === manifest.mediaEntries.length - included.length
    && summary.includedByteSize === included.reduce((total, entry) => total + entry.byteSize, 0)
    && summary.originalIncludedCount === included.filter((entry) => entry.kind === 'original').length
    && summary.thumbnailIncludedCount === included.filter((entry) => entry.kind === 'thumbnail').length;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
}

async function detectImageMimeType(blob: Blob): Promise<string | undefined> {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
