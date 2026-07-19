import type { Scrapbook, ScrapbookBlock, ScrapbookContentOrigin, ScrapbookPage } from '../models/scrapbook';

export const SCRAPBOOK_SCHEMA_SOURCE_REVISION = 1;

export function migrateScrapbookToV9(value: Scrapbook): Scrapbook {
  const origin = normalizeOrigin(value.origin);
  return {
    ...value,
    origin,
    sourceType: value.sourceType ?? (origin === 'generated' ? 'trip' : undefined),
    sourceId: value.sourceId ?? (origin === 'generated' ? value.tripId : undefined),
    sourceKey: value.sourceKey ?? (origin === 'generated' ? `trip:${value.tripId}` : undefined),
    sourceRevision: normalizeSourceRevision(value.sourceRevision, origin),
    userEditedFields: normalizeEditedFields(value.userEditedFields),
    layoutVariant: normalizeOptionalString(value.layoutVariant),
    coverSettings: normalizeCoverSettings(value.coverSettings),
    highlightPhotoIds: normalizeEntityIds(value.highlightPhotoIds),
  };
}

export function migrateScrapbookPageToV9(value: ScrapbookPage): ScrapbookPage {
  const origin = normalizeOrigin(value.origin);
  return {
    ...value,
    origin,
    sourceRevision: normalizeSourceRevision(value.sourceRevision, origin),
    userEditedFields: normalizeEditedFields(value.userEditedFields),
    isHidden: value.isHidden === true,
    layoutVariant: normalizeOptionalString(value.layoutVariant),
  };
}

export function migrateScrapbookBlockToV9(value: ScrapbookBlock): ScrapbookBlock {
  const origin = normalizeOrigin(value.origin);
  return {
    ...value,
    origin,
    sourceRevision: normalizeSourceRevision(value.sourceRevision, origin),
    userEditedFields: normalizeEditedFields(value.userEditedFields),
    isHidden: value.isHidden === true,
    layoutVariant: normalizeOptionalString(value.layoutVariant),
  };
}

function normalizeOrigin(value: unknown): ScrapbookContentOrigin {
  return value === 'manual' ? 'manual' : 'generated';
}

function normalizeSourceRevision(value: unknown, origin: ScrapbookContentOrigin): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) return Math.floor(value);
  return origin === 'generated' ? SCRAPBOOK_SCHEMA_SOURCE_REVISION : undefined;
}

function normalizeEditedFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((field): field is string => typeof field === 'string' && field.length > 0))];
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normalizeEntityIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  return ids.length > 0 ? ids : [];
}

function normalizeCoverSettings(value: unknown): Scrapbook['coverSettings'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const settings = value as Record<string, unknown>;
  const normalized = {
    photoId: normalizeOptionalString(settings.photoId),
    titlePosition: normalizeOptionalString(settings.titlePosition),
    layout: normalizeOptionalString(settings.layout),
  };
  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}
