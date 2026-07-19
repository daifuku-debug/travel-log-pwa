import type { EntityId } from '../../domain/models/common';
import type {
  MediaAsset,
  Scrapbook,
  ScrapbookBlock,
  ScrapbookPage,
  ScrapbookStatus,
  ScrapbookThemeId,
} from '../../domain/models/scrapbook';
import experienceRules from '../../domain/rpg/experienceRules.json';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { compareDateInputValuesDesc } from '../../shared/date/dateUtils';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { SCRAPBOOK_SCHEMA_SOURCE_REVISION } from '../../domain/scrapbooks/scrapbookMigration';
import { grantExperienceOnce } from '../rpg/experienceService';
import { refreshRpgProgress } from '../rpg/rpgProgressService';
import { appendEditedFields } from './scrapbookRevision';

const LOCAL_USER_ID = 'local-user';

export interface ScrapbookDetail {
  scrapbook: Scrapbook;
  pages: Array<ScrapbookPage & { blocks: ScrapbookBlock[] }>;
  mediaAssets: MediaAsset[];
}

export interface ScrapbookInput {
  title: string;
  subtitle: string;
  themeId: ScrapbookThemeId;
  status: ScrapbookStatus;
  isFavorite: boolean;
}

export interface ScrapbookPageInput {
  title: string;
  date: string;
  dayNumber: number;
  layoutType: ScrapbookPage['layoutType'];
  backgroundStyle: string;
}

export interface ScrapbookBlockInput {
  type: ScrapbookBlock['type'];
  text: string;
  locationId: string;
  title: string;
  note: string;
  assetId?: EntityId;
  assetIds?: EntityId[];
}

export async function listRecentScrapbooks(limit = 3): Promise<Scrapbook[]> {
  try {
    return repositories.scrapbooks.listRecent(limit);
  } catch (error) {
    throw toAppError(error, '最近のスクラップブックの読み込みに失敗しました');
  }
}

export async function getScrapbookByTripId(tripId: EntityId): Promise<ScrapbookDetail | undefined> {
  try {
    const scrapbook = await repositories.scrapbooks.getByTripId(tripId);
    if (!scrapbook) return undefined;
    return getScrapbookDetail(scrapbook.id);
  } catch (error) {
    throw toAppError(error, 'スクラップブックの読み込みに失敗しました');
  }
}

export async function getScrapbookDetail(scrapbookId: EntityId): Promise<ScrapbookDetail | undefined> {
  try {
    const scrapbook = await repositories.scrapbooks.getById(scrapbookId);
    if (!scrapbook) return undefined;
    const [pages, mediaAssets] = await Promise.all([
      repositories.scrapbookPages.listByScrapbookId(scrapbookId),
      repositories.mediaAssets.listByTripId(scrapbook.tripId),
    ]);
    const pagesWithBlocks = await Promise.all(
      pages.map(async (page) => ({
        ...page,
        blocks: await repositories.scrapbookBlocks.listByPageId(page.id),
      })),
    );
    return {
      scrapbook,
      pages: pagesWithBlocks,
      mediaAssets,
    };
  } catch (error) {
    throw toAppError(error, 'スクラップブック詳細の読み込みに失敗しました');
  }
}

export async function createScrapbookForTrip(tripId: EntityId): Promise<Scrapbook> {
  try {
    const existing = await repositories.scrapbooks.getByTripId(tripId);
    if (existing) return existing;
    const trip = await repositories.trips.getById(tripId);
    if (!trip) throw new Error('旅行が見つかりません。');

    const now = new Date().toISOString();
    const scrapbook = await repositories.scrapbooks.save({
      id: createId('scrapbook'),
      userId: LOCAL_USER_ID,
      tripId,
      origin: 'generated',
      sourceType: 'trip',
      sourceId: trip.id,
      sourceKey: `trip:${trip.id}`,
      sourceRevision: SCRAPBOOK_SCHEMA_SOURCE_REVISION,
      userEditedFields: [],
      title: `${trip.title}のスクラップブック`,
      subtitle: trip.purpose,
      coverLayout: 'journal',
      themeId: 'journal',
      layoutMode: 'pages',
      status: 'draft',
      isFavorite: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    await generateInitialScrapbookContent(scrapbook.id);
    await grantScrapbookCreatedExperience(scrapbook.id);
    await refreshRpgProgress();
    return scrapbook;
  } catch (error) {
    throw toAppError(error, 'スクラップブックの作成に失敗しました');
  }
}

export async function updateScrapbook(scrapbookId: EntityId, input: ScrapbookInput): Promise<Scrapbook> {
  try {
    assertNoValidationErrors(validateScrapbookInput(input));
    const current = await repositories.scrapbooks.getById(scrapbookId);
    if (!current) throw new Error('スクラップブックが見つかりません。');
    const now = new Date().toISOString();
    const nextTitle = input.title.trim();
    const nextSubtitle = optionalText(input.subtitle);
    const changedFields = collectChangedFields([
      ['title', current.title, nextTitle],
      ['subtitle', current.subtitle, nextSubtitle],
      ['themeId', current.themeId, input.themeId],
      ['status', current.status, input.status],
      ['isFavorite', current.isFavorite, input.isFavorite],
    ]);
    const saved = await repositories.scrapbooks.save({
      ...current,
      title: nextTitle,
      subtitle: nextSubtitle,
      themeId: input.themeId,
      status: input.status,
      isFavorite: input.isFavorite,
      userEditedFields: appendEditedFields(current.userEditedFields, changedFields),
      publishedAt: input.status === 'completed' ? current.publishedAt ?? now : current.publishedAt,
      version: current.version + 1,
      updatedAt: now,
      syncStatus: 'pending',
    });
    await grantScrapbookCompletionExperience(saved.id, current.status, saved.status);
    await refreshRpgProgress();
    return saved;
  } catch (error) {
    throw toAppError(error, 'スクラップブックの保存に失敗しました');
  }
}

export async function addScrapbookPage(scrapbookId: EntityId, input: ScrapbookPageInput): Promise<ScrapbookPage> {
  try {
    assertNoValidationErrors(validatePageInput(input));
    const pages = await repositories.scrapbookPages.listByScrapbookId(scrapbookId);
    const now = new Date().toISOString();
    return repositories.scrapbookPages.save({
      id: createId('scrapbook-page'),
      userId: LOCAL_USER_ID,
      scrapbookId,
      origin: 'manual',
      userEditedFields: [],
      title: input.title.trim(),
      date: optionalText(input.date),
      dayNumber: input.dayNumber > 0 ? Math.floor(input.dayNumber) : undefined,
      sortOrder: nextSortOrder(pages),
      layoutType: input.layoutType,
      backgroundStyle: optionalText(input.backgroundStyle),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, 'ページの追加に失敗しました');
  }
}

export async function updateScrapbookPage(pageId: EntityId, input: ScrapbookPageInput): Promise<ScrapbookPage> {
  try {
    assertNoValidationErrors(validatePageInput(input));
    const current = await repositories.scrapbookPages.getById(pageId);
    if (!current) throw new Error('ページが見つかりません。');
    const nextTitle = input.title.trim();
    const nextDate = optionalText(input.date);
    const nextDayNumber = input.dayNumber > 0 ? Math.floor(input.dayNumber) : undefined;
    const nextBackgroundStyle = optionalText(input.backgroundStyle);
    const changedFields = collectChangedFields([
      ['title', current.title, nextTitle],
      ['date', current.date, nextDate],
      ['dayNumber', current.dayNumber, nextDayNumber],
      ['layoutType', current.layoutType, input.layoutType],
      ['backgroundStyle', current.backgroundStyle, nextBackgroundStyle],
    ]);
    return repositories.scrapbookPages.save({
      ...current,
      title: nextTitle,
      date: nextDate,
      dayNumber: nextDayNumber,
      layoutType: input.layoutType,
      backgroundStyle: nextBackgroundStyle,
      userEditedFields: appendEditedFields(current.userEditedFields, changedFields),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, 'ページの保存に失敗しました');
  }
}

export async function deleteScrapbookPage(pageId: EntityId): Promise<void> {
  try {
    const blocks = await repositories.scrapbookBlocks.listByPageId(pageId);
    await Promise.all(blocks.map((block) => repositories.scrapbookBlocks.softDelete(block.id)));
    await repositories.scrapbookPages.softDelete(pageId);
  } catch (error) {
    throw toAppError(error, 'ページの削除に失敗しました');
  }
}

export async function moveScrapbookPage(pageId: EntityId, direction: -1 | 1): Promise<void> {
  try {
    const current = await repositories.scrapbookPages.getById(pageId);
    if (!current) throw new Error('ページが見つかりません。');
    const pages = await repositories.scrapbookPages.listByScrapbookId(current.scrapbookId);
    await swapSortOrder(pages, pageId, direction, (page) => repositories.scrapbookPages.save({
      ...page,
      userEditedFields: appendEditedFields(page.userEditedFields, ['sortOrder']),
    }));
  } catch (error) {
    throw toAppError(error, 'ページの並び替えに失敗しました');
  }
}

export async function addScrapbookBlock(pageId: EntityId, input: ScrapbookBlockInput): Promise<ScrapbookBlock> {
  try {
    const page = await repositories.scrapbookPages.getById(pageId);
    if (!page) throw new Error('ページが見つかりません。');
    const blocks = await repositories.scrapbookBlocks.listByPageId(pageId);
    const now = new Date().toISOString();
    return repositories.scrapbookBlocks.save(buildBlock({
      id: createId('scrapbook-block'),
      pageId,
      sortOrder: nextSortOrder(blocks),
      now,
      input,
    }));
  } catch (error) {
    throw toAppError(error, 'ブロックの追加に失敗しました');
  }
}

export async function addPhotoBlockFromFile(
  pageId: EntityId,
  tripId: EntityId,
  file: File,
  caption: string,
  body = '',
  title = '',
): Promise<ScrapbookBlock> {
  try {
    const asset = await saveLocalMediaAsset(tripId, file);
    return addScrapbookBlock(pageId, {
      type: 'photo',
      text: body,
      locationId: '',
      title,
      note: caption,
      assetId: asset.id,
    });
  } catch (error) {
    throw toAppError(error, '写真ブロックの追加に失敗しました');
  }
}

export async function addPhotoGridBlockFromFiles(
  pageId: EntityId,
  tripId: EntityId,
  files: File[],
  caption: string,
  body = '',
  title = '',
): Promise<ScrapbookBlock> {
  try {
    const assets = await Promise.all(files.map((file) => saveLocalMediaAsset(tripId, file)));
    return addScrapbookBlock(pageId, {
      type: 'photo_grid',
      text: body,
      locationId: '',
      title,
      note: caption,
      assetIds: assets.map((asset) => asset.id),
    });
  } catch (error) {
    throw toAppError(error, '写真グリッドの追加に失敗しました');
  }
}

export async function updateScrapbookBlock(blockId: EntityId, input: ScrapbookBlockInput): Promise<ScrapbookBlock> {
  try {
    const current = await repositories.scrapbookBlocks.getById(blockId);
    if (!current) throw new Error('ブロックが見つかりません。');
    const rebuilt = buildBlock({
      id: current.id,
      pageId: current.pageId,
      sortOrder: current.sortOrder,
      now: current.createdAt,
      input,
    });
    return repositories.scrapbookBlocks.save({
      ...rebuilt,
      origin: current.origin,
      sourceRevision: current.sourceRevision,
      sourceType: current.sourceType,
      sourceId: current.sourceId,
      sourceKey: current.sourceKey,
      generatedAt: current.generatedAt,
      userEditedFields: appendEditedFields(current.userEditedFields, collectBlockChangedFields(current, rebuilt)),
      isHidden: current.isHidden,
      layoutVariant: current.layoutVariant,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, 'ブロックの保存に失敗しました');
  }
}

export async function deleteScrapbookBlock(blockId: EntityId): Promise<void> {
  try {
    await repositories.scrapbookBlocks.softDelete(blockId);
  } catch (error) {
    throw toAppError(error, 'ブロックの削除に失敗しました');
  }
}

export async function createMediaObjectUrl(asset: MediaAsset, kind: 'original' | 'thumbnail' = 'thumbnail'): Promise<string | undefined> {
  try {
    const blobId = kind === 'thumbnail' ? asset.thumbnailReference ?? asset.localReference : asset.localReference;
    if (!blobId) return undefined;
    const mediaBlob = await repositories.mediaAssetBlobs.getById(blobId);
    if (!mediaBlob) return undefined;
    return URL.createObjectURL(mediaBlob.blob);
  } catch (error) {
    throw toAppError(error, '写真の読み込みに失敗しました');
  }
}

export async function moveScrapbookBlock(blockId: EntityId, direction: -1 | 1): Promise<void> {
  try {
    const current = await repositories.scrapbookBlocks.getById(blockId);
    if (!current) throw new Error('ブロックが見つかりません。');
    const blocks = await repositories.scrapbookBlocks.listByPageId(current.pageId);
    await swapSortOrder(blocks, blockId, direction, (block) => repositories.scrapbookBlocks.save({
      ...block,
      userEditedFields: appendEditedFields(block.userEditedFields, ['sortOrder']),
    }));
  } catch (error) {
    throw toAppError(error, 'ブロックの並び替えに失敗しました');
  }
}

async function generateInitialScrapbookContent(scrapbookId: EntityId): Promise<void> {
  const scrapbook = await repositories.scrapbooks.getById(scrapbookId);
  if (!scrapbook) return;
  const trip = await repositories.trips.getById(scrapbook.tripId);
  if (!trip) return;
  const places = await repositories.placeVisits.listByTripId(trip.id);
  const existingPages = await repositories.scrapbookPages.listByScrapbookId(scrapbookId);
  const existingPageKeys = new Set(existingPages.map((page) => page.sourceKey).filter(Boolean));
  const now = new Date().toISOString();

  if (!existingPageKeys.has(`cover:${trip.id}`)) {
    const coverPage = await repositories.scrapbookPages.save({
      id: createId('scrapbook-page'),
      userId: LOCAL_USER_ID,
      scrapbookId,
      origin: 'generated',
      sourceRevision: SCRAPBOOK_SCHEMA_SOURCE_REVISION,
      userEditedFields: [],
      title: '表紙',
      sortOrder: 10,
      layoutType: 'cover',
      sourceType: 'trip',
      sourceId: trip.id,
      sourceKey: `cover:${trip.id}`,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    await repositories.scrapbookBlocks.save({
      id: createId('scrapbook-block'),
      userId: LOCAL_USER_ID,
      pageId: coverPage.id,
      origin: 'generated',
      sourceRevision: SCRAPBOOK_SCHEMA_SOURCE_REVISION,
      userEditedFields: [],
      type: 'trip_summary',
      sortOrder: 10,
      title: trip.title,
      body: trip.memo,
      sourceType: 'trip',
      sourceId: trip.id,
      sourceKey: `trip-summary:${trip.id}`,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  }

  const tripDates = enumerateDates(trip.startDate, trip.endDate);
  let pageSortOrder = 20;
  for (const [index, date] of tripDates.entries()) {
    const sourceKey = `day:${trip.id}:${date}`;
    if (existingPageKeys.has(sourceKey)) continue;
    const page = await repositories.scrapbookPages.save({
      id: createId('scrapbook-page'),
      userId: LOCAL_USER_ID,
      scrapbookId,
      origin: 'generated',
      sourceRevision: SCRAPBOOK_SCHEMA_SOURCE_REVISION,
      userEditedFields: [],
      title: `${index + 1}日目`,
      date,
      dayNumber: index + 1,
      sortOrder: pageSortOrder,
      layoutType: 'day',
      sourceType: 'trip',
      sourceId: trip.id,
      sourceKey,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    const placesForDate = places.filter((place) => !place.visitedAt || place.visitedAt.slice(0, 10) === date);
    let blockSortOrder = 10;
    for (const place of placesForDate) {
      await repositories.scrapbookBlocks.save({
        id: createId('scrapbook-block'),
        userId: LOCAL_USER_ID,
        pageId: page.id,
        origin: 'generated',
        sourceRevision: SCRAPBOOK_SCHEMA_SOURCE_REVISION,
        userEditedFields: [],
        type: 'place',
        sortOrder: blockSortOrder,
        locationId: place.id,
        snapshotName: place.name,
        caption: place.memo,
        sourceType: 'place',
        sourceId: place.id,
        sourceKey: `place:${place.id}`,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      });
      blockSortOrder += 10;
    }
    pageSortOrder += 10;
  }

  if (!existingPageKeys.has(`summary:${trip.id}`)) {
    await repositories.scrapbookPages.save({
      id: createId('scrapbook-page'),
      userId: LOCAL_USER_ID,
      scrapbookId,
      origin: 'generated',
      sourceRevision: SCRAPBOOK_SCHEMA_SOURCE_REVISION,
      userEditedFields: [],
      title: '旅のまとめ',
      sortOrder: pageSortOrder,
      layoutType: 'summary',
      sourceType: 'trip',
      sourceId: trip.id,
      sourceKey: `summary:${trip.id}`,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  }
}

function buildBlock({
  id,
  pageId,
  sortOrder,
  now,
  input,
}: {
  id: EntityId;
  pageId: EntityId;
  sortOrder: number;
  now: string;
  input: ScrapbookBlockInput;
}): ScrapbookBlock {
  const base = {
    id,
    userId: LOCAL_USER_ID,
    pageId,
    origin: 'manual' as const,
    userEditedFields: [],
    sortOrder,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending' as const,
  };
  if (input.type === 'heading') return { ...base, type: 'heading', text: input.text.trim() || '見出し', level: 2 };
  if (input.type === 'place') {
    return {
      ...base,
      type: 'place',
      locationId: input.locationId,
      snapshotName: input.title.trim() || '訪問場所',
      body: optionalText(input.text),
      caption: optionalText(input.note),
    };
  }
  if (input.type === 'quote') return { ...base, type: 'quote', text: input.text.trim() || '印象に残った言葉', cite: optionalText(input.title) };
  if (input.type === 'divider') return { ...base, type: 'divider', label: optionalText(input.title) };
  if (input.type === 'photo') {
    return {
      ...base,
      type: 'photo',
      assetId: input.assetId || input.locationId,
      title: optionalText(input.title),
      body: optionalText(input.text),
      caption: optionalText(input.note),
      altText: optionalText(input.title),
      displaySize: 'large',
    };
  }
  if (input.type === 'photo_grid') {
    return {
      ...base,
      type: 'photo_grid',
      assetIds: input.assetIds ?? [],
      title: optionalText(input.title),
      body: optionalText(input.text),
      caption: optionalText(input.note),
      columns: 2,
    };
  }
  if (input.type === 'meal') return { ...base, type: 'meal', name: input.title.trim() || '食事', body: optionalText(input.text), note: optionalText(input.note), assetIds: [], isBestMeal: false };
  if (input.type === 'ticket') return { ...base, type: 'ticket', itemType: 'ticket', title: input.title.trim() || 'チケット', body: optionalText(input.text), note: optionalText(input.note) };
  if (input.type === 'purchase') return { ...base, type: 'purchase', name: input.title.trim() || '買ったもの', body: optionalText(input.text), note: optionalText(input.note), assetIds: [] };
  if (input.type === 'trip_summary') return { ...base, type: 'trip_summary', title: optionalText(input.title), body: optionalText(input.text) };
  if (input.type === 'rpg_result') return { ...base, type: 'rpg_result', tripId: input.locationId || 'unknown-trip', title: optionalText(input.title) };
  return {
    ...base,
    type: 'text',
    title: optionalText(input.title),
    text: input.text.trim() || 'メモを書く',
    note: optionalText(input.note),
    textStyle: 'body',
  };
}

async function saveLocalMediaAsset(tripId: EntityId, file: File): Promise<MediaAsset> {
  validateImageFile(file);
  const now = new Date().toISOString();
  const assetId = createId('media-asset');
  const originalBlobId = `${assetId}:original`;
  const thumbnailBlobId = `${assetId}:thumbnail`;
  const image = await createImagePreview(file);
  const thumbnail = image ? await createThumbnailBlob(image, file.type) : undefined;

  await repositories.mediaAssetBlobs.save({
    id: originalBlobId,
    assetId,
    kind: 'original',
    blob: file,
    mimeType: file.type,
    createdAt: now,
  });
  if (thumbnail) {
    await repositories.mediaAssetBlobs.save({
      id: thumbnailBlobId,
      assetId,
      kind: 'thumbnail',
      blob: thumbnail.blob,
      mimeType: thumbnail.blob.type || file.type,
      createdAt: now,
    });
  }

  return repositories.mediaAssets.save({
    id: assetId,
    userId: LOCAL_USER_ID,
    tripId,
    storageType: 'local',
    localReference: originalBlobId,
    thumbnailReference: thumbnail ? thumbnailBlobId : originalBlobId,
    mimeType: file.type,
    width: thumbnail?.sourceWidth,
    height: thumbnail?.sourceHeight,
    fileSize: file.size,
    originalFileName: file.name,
    mediaSyncStatus: 'local_only',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  });
}

function validateImageFile(file: File): void {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選択してください。');
  const maxBytes = 12 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error('写真は12MB以下にしてください。');
}

async function createImagePreview(file: File): Promise<HTMLImageElement | undefined> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') return undefined;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('画像を読み込めませんでした。'));
      image.src = objectUrl;
    });
    return image;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createThumbnailBlob(
  image: HTMLImageElement,
  mimeType: string,
): Promise<{ blob: Blob; sourceWidth: number; sourceHeight: number } | undefined> {
  if (typeof document === 'undefined') return undefined;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return undefined;
  const maxEdge = 960;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.drawImage(image, 0, 0, width, height);
  const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | undefined>((resolve) => {
    canvas.toBlob((value) => resolve(value ?? undefined), outputType, 0.82);
  });
  return blob ? { blob, sourceWidth, sourceHeight } : undefined;
}

export function validateScrapbookInput(input: ScrapbookInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('タイトルを入力してください。');
  return errors;
}

export function validatePageInput(input: ScrapbookPageInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('ページ名を入力してください。');
  return errors;
}

function assertNoValidationErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function optionalText(value?: string): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed || undefined;
}

function collectChangedFields(entries: Array<[string, unknown, unknown]>): string[] {
  return entries
    .filter(([, current, next]) => !valuesEqual(current, next))
    .map(([field]) => field);
}

function collectBlockChangedFields(current: ScrapbookBlock, next: ScrapbookBlock): string[] {
  const ignoredFields = new Set([
    'id',
    'userId',
    'pageId',
    'origin',
    'sourceRevision',
    'userEditedFields',
    'isHidden',
    'sortOrder',
    'layoutVariant',
    'sourceType',
    'sourceId',
    'sourceKey',
    'generatedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'syncStatus',
  ]);
  const currentFields = current as unknown as Record<string, unknown>;
  const nextFields = next as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(currentFields), ...Object.keys(nextFields)])]
    .filter((field) => !ignoredFields.has(field) && !valuesEqual(currentFields[field], nextFields[field]));
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function nextSortOrder(values: Array<{ sortOrder: number }>): number {
  return values.length === 0 ? 10 : Math.max(...values.map((value) => value.sortOrder)) + 10;
}

async function swapSortOrder<T extends { id: EntityId; sortOrder: number; updatedAt: string; syncStatus: 'synced' | 'pending' | 'conflict' }>(
  values: T[],
  id: EntityId,
  direction: -1 | 1,
  save: (value: T) => Promise<T>,
): Promise<void> {
  const index = values.findIndex((value) => value.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= values.length) return;
  const now = new Date().toISOString();
  const current = values[index];
  const other = values[target];
  await Promise.all([
    save({ ...current, sortOrder: other.sortOrder, updatedAt: now, syncStatus: 'pending' }),
    save({ ...other, sortOrder: current.sortOrder, updatedAt: now, syncStatus: 'pending' }),
  ]);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (current <= end && dates.length < 32) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates.sort(compareDateInputValuesDesc).reverse();
}

async function grantScrapbookCreatedExperience(scrapbookId: EntityId): Promise<void> {
  await grantExperienceOnce({
    amount: experienceRules.scrapbookCreated,
    sourceType: 'scrapbook',
    sourceId: scrapbookId,
    sourceKey: `scrapbook-created:${scrapbookId}`,
    reason: 'スクラップブックを作成',
    metadata: { scrapbookId },
  });
}

async function grantScrapbookCompletionExperience(
  scrapbookId: EntityId,
  previousStatus: ScrapbookStatus,
  nextStatus: ScrapbookStatus,
): Promise<void> {
  if (previousStatus === 'completed' || nextStatus !== 'completed') return;
  const detail = await getScrapbookDetail(scrapbookId);
  const blocks = detail?.pages.flatMap((page) => page.blocks) ?? [];
  await grantExperienceOnce({
    amount: experienceRules.scrapbookCompleted,
    sourceType: 'scrapbook',
    sourceId: scrapbookId,
    sourceKey: `scrapbook-completed:${scrapbookId}`,
    reason: 'スクラップブックを完成',
    metadata: { scrapbookId },
  });
  const photoCount = blocks.reduce((count, block) => {
    if (block.type === 'photo') return count + 1;
    if (block.type === 'photo_grid') return count + block.assetIds.length;
    return count;
  }, 0);
  if (photoCount >= 5) {
    await grantExperienceOnce({
      amount: experienceRules.scrapbookPhotoMilestone,
      sourceType: 'scrapbook',
      sourceId: scrapbookId,
      sourceKey: `scrapbook-photo-milestone:${scrapbookId}:5`,
      reason: '写真つきスクラップブックを完成',
      metadata: { scrapbookId },
    });
  }
  if (blocks.some((block) => block.type === 'text' && block.text.length >= 80)) {
    await grantExperienceOnce({
      amount: experienceRules.scrapbookReflectionAdded,
      sourceType: 'scrapbook',
      sourceId: scrapbookId,
      sourceKey: `scrapbook-reflection-added:${scrapbookId}`,
      reason: '旅の感想を記録',
      metadata: { scrapbookId },
    });
  }
}
