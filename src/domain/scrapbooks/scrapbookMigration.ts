import type {
  Scrapbook,
  ScrapbookBlock,
  ScrapbookContentOrigin,
  ScrapbookPage,
  ScrapbookPageKind,
} from '../models/scrapbook';

export const SCRAPBOOK_SCHEMA_SOURCE_REVISION = 2;

export function migrateScrapbookToV10(value: Scrapbook): Scrapbook {
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

export function migrateScrapbookPageToV10(value: ScrapbookPage): ScrapbookPage {
  const origin = normalizeOrigin(value.origin);
  return {
    ...value,
    origin,
    sourceRevision: normalizeSourceRevision(value.sourceRevision, origin),
    userEditedFields: normalizeEditedFields(value.userEditedFields),
    isHidden: value.isHidden === true,
    pageKind: normalizePageKind(value.pageKind, value),
    layoutVariant: normalizeOptionalString(value.layoutVariant),
  };
}

export function migrateScrapbookBlockToV10(value: ScrapbookBlock): ScrapbookBlock {
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
    showDate: normalizeOptionalBoolean(settings.showDate),
    showLocation: normalizeOptionalBoolean(settings.showLocation),
    showSubtitle: normalizeOptionalBoolean(settings.showSubtitle),
  };
  return Object.values(normalized).some((entry) => entry !== undefined) ? normalized : undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizePageKind(value: unknown, page: ScrapbookPage): ScrapbookPageKind {
  const kinds: ScrapbookPageKind[] = ['cover', 'story', 'timeline', 'photo', 'place', 'feature', 'ending', 'custom'];
  if (typeof value === 'string' && kinds.includes(value as ScrapbookPageKind)) return value as ScrapbookPageKind;
  if (page.layoutType === 'cover' || page.sourceKey?.startsWith('cover:')) return 'cover';
  if (page.sourceKey?.startsWith('story:') || /旅のはじまり|物語/.test(page.title)) return 'story';
  if (page.sourceKey?.startsWith('timeline:') || /旅の流れ|タイムライン/.test(page.title)) return 'timeline';
  if (page.sourceKey?.startsWith('photo:') || /旅の景色|写真|フォト/.test(page.title)) return 'photo';
  if (page.sourceKey?.startsWith('place:') || /旅の舞台|訪問場所/.test(page.title)) return 'place';
  if (page.sourceKey?.startsWith('ending:') || page.layoutType === 'summary' || /旅のまとめ|旅の余韻|編集後記/.test(page.title)) return 'ending';
  if (page.layoutType === 'day') return page.dayNumber === 1 ? 'timeline' : 'place';
  return 'custom';
}
