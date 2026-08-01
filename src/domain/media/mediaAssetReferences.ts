import type { EntityId } from '../models/common.ts';
import type { Scrapbook, ScrapbookBlock, ScrapbookPage } from '../models/scrapbook.ts';

export type MediaAssetReferenceType =
  | 'scrapbook-cover'
  | 'scrapbook-legacy-cover'
  | 'scrapbook-highlight'
  | 'scrapbook-block';

export type MediaAssetReferenceField =
  | 'coverSettings.photoId'
  | 'coverAssetId'
  | 'highlightPhotoIds'
  | 'assetId'
  | 'assetIds';

export interface MediaAssetReference {
  type: MediaAssetReferenceType;
  assetId: EntityId;
  tripId: EntityId;
  scrapbookId: EntityId;
  pageId?: EntityId;
  blockId?: EntityId;
  field: MediaAssetReferenceField;
  blockType?: ScrapbookBlock['type'];
  ownerLabel?: string;
  pageLabel?: string;
  blockLabel?: string;
  occurrenceIndex?: number;
  pageSortOrder?: number;
  blockSortOrder?: number;
}

export interface MediaAssetReferenceSummary {
  totalCount: number;
  coverCount: number;
  highlightCount: number;
  blockCount: number;
  canDeleteWithoutDetaching: boolean;
}

export interface ScrapbookMediaGraph {
  scrapbook: Scrapbook;
  pages: Array<{
    page: ScrapbookPage;
    blocks: ScrapbookBlock[];
  }>;
}

interface BlockReferenceContext {
  tripId: EntityId;
  scrapbookId: EntityId;
  page: ScrapbookPage;
}

export interface PersistentMediaAssetReferenceEntry {
  assetId: EntityId;
  field: MediaAssetReferenceField;
  occurrenceIndex?: number;
}

export function findScrapbookMediaAssetReferences(
  scrapbook: Scrapbook,
  assetId: EntityId,
): MediaAssetReference[] {
  if (scrapbook.deletedAt) return [];

  return collectScrapbookMediaAssetReferenceEntries(scrapbook)
    .filter((entry) => entry.assetId === assetId)
    .map((entry) => ({
      type: entry.field === 'coverSettings.photoId'
        ? 'scrapbook-cover'
        : entry.field === 'coverAssetId'
          ? 'scrapbook-legacy-cover'
          : 'scrapbook-highlight',
      assetId,
      tripId: scrapbook.tripId,
      scrapbookId: scrapbook.id,
      ownerLabel: optionalLabel(scrapbook.title),
      field: entry.field,
      occurrenceIndex: entry.occurrenceIndex,
    }));
}

export function collectScrapbookMediaAssetReferenceEntries(
  scrapbook: Scrapbook,
): PersistentMediaAssetReferenceEntry[] {
  const entries: PersistentMediaAssetReferenceEntry[] = [];
  if (scrapbook.coverSettings?.photoId) {
    entries.push({ assetId: scrapbook.coverSettings.photoId, field: 'coverSettings.photoId' });
  }
  if (scrapbook.coverAssetId) {
    entries.push({ assetId: scrapbook.coverAssetId, field: 'coverAssetId' });
  }
  scrapbook.highlightPhotoIds?.forEach((assetId, occurrenceIndex) => {
    entries.push({ assetId, field: 'highlightPhotoIds', occurrenceIndex });
  });
  return entries;
}

export function findBlockMediaAssetReferences(
  block: ScrapbookBlock,
  context: BlockReferenceContext,
  assetId: EntityId,
): MediaAssetReference[] {
  if (block.deletedAt || context.page.deletedAt) return [];

  const base = {
    type: 'scrapbook-block' as const,
    assetId,
    tripId: context.tripId,
    scrapbookId: context.scrapbookId,
    pageId: context.page.id,
    blockId: block.id,
    blockType: block.type,
    pageLabel: optionalLabel(context.page.title),
    blockLabel: getBlockLabel(block),
    pageSortOrder: context.page.sortOrder,
    blockSortOrder: block.sortOrder,
  };

  return collectBlockMediaAssetReferenceEntries(block)
    .filter((entry) => entry.assetId === assetId)
    .map((entry) => ({
      ...base,
      field: entry.field,
      occurrenceIndex: entry.occurrenceIndex,
    }));
}

export function collectBlockMediaAssetReferenceEntries(
  block: ScrapbookBlock,
): PersistentMediaAssetReferenceEntry[] {
  switch (block.type) {
    case 'photo':
      return [{ assetId: block.assetId, field: 'assetId' }];
    case 'photo_grid':
    case 'meal':
    case 'purchase':
      return block.assetIds.map((assetId, occurrenceIndex) => ({ assetId, field: 'assetIds', occurrenceIndex }));
    case 'ticket':
      return block.assetId ? [{ assetId: block.assetId, field: 'assetId' }] : [];
    case 'text':
    case 'heading':
    case 'place':
    case 'quote':
    case 'divider':
    case 'trip_summary':
    case 'rpg_result':
      return [];
  }
}

export function collectMediaAssetReferencesFromScrapbookGraph(
  graph: ScrapbookMediaGraph,
  assetId: EntityId,
): MediaAssetReference[] {
  if (graph.scrapbook.deletedAt) return [];

  const references = findScrapbookMediaAssetReferences(graph.scrapbook, assetId);
  const pages = graph.pages
    .filter(({ page }) => !page.deletedAt)
    .slice()
    .sort((left, right) => compareOrderedEntities(left.page, right.page));

  for (const { page, blocks } of pages) {
    const sortedBlocks = blocks
      .filter((block) => !block.deletedAt)
      .slice()
      .sort(compareOrderedEntities);
    for (const block of sortedBlocks) {
      references.push(...findBlockMediaAssetReferences(block, {
        tripId: graph.scrapbook.tripId,
        scrapbookId: graph.scrapbook.id,
        page,
      }, assetId));
    }
  }

  return sortMediaAssetReferences(references);
}

export function sortMediaAssetReferences(references: MediaAssetReference[]): MediaAssetReference[] {
  return references.slice().sort((left, right) => {
    const typeDifference = referenceTypeOrder(left.type) - referenceTypeOrder(right.type);
    if (typeDifference) return typeDifference;
    const scrapbookDifference = left.scrapbookId.localeCompare(right.scrapbookId);
    if (scrapbookDifference) return scrapbookDifference;
    const pageOrderDifference = (left.pageSortOrder ?? -1) - (right.pageSortOrder ?? -1);
    if (pageOrderDifference) return pageOrderDifference;
    const pageDifference = (left.pageId ?? '').localeCompare(right.pageId ?? '');
    if (pageDifference) return pageDifference;
    const blockOrderDifference = (left.blockSortOrder ?? -1) - (right.blockSortOrder ?? -1);
    if (blockOrderDifference) return blockOrderDifference;
    const blockDifference = (left.blockId ?? '').localeCompare(right.blockId ?? '');
    if (blockDifference) return blockDifference;
    const fieldDifference = left.field.localeCompare(right.field);
    if (fieldDifference) return fieldDifference;
    return (left.occurrenceIndex ?? -1) - (right.occurrenceIndex ?? -1);
  });
}

export function summarizeMediaAssetReferences(
  references: MediaAssetReference[],
): MediaAssetReferenceSummary {
  const coverCount = references.filter((reference) => (
    reference.type === 'scrapbook-cover' || reference.type === 'scrapbook-legacy-cover'
  )).length;
  const highlightCount = references.filter((reference) => reference.type === 'scrapbook-highlight').length;
  const blockCount = references.filter((reference) => reference.type === 'scrapbook-block').length;
  return {
    totalCount: references.length,
    coverCount,
    highlightCount,
    blockCount,
    canDeleteWithoutDetaching: references.length === 0,
  };
}

function getBlockLabel(block: ScrapbookBlock): string | undefined {
  switch (block.type) {
    case 'photo':
    case 'photo_grid':
      return optionalLabel(block.title ?? block.caption);
    case 'meal':
    case 'purchase':
      return optionalLabel(block.name);
    case 'ticket':
      return optionalLabel(block.title);
    case 'heading':
    case 'quote':
      return optionalLabel(block.text);
    case 'text':
    case 'trip_summary':
    case 'rpg_result':
      return optionalLabel(block.title);
    case 'place':
      return optionalLabel(block.titleOverride ?? block.snapshotName);
    case 'divider':
      return optionalLabel(block.label);
  }
}

function optionalLabel(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function compareOrderedEntities(
  left: { id: EntityId; sortOrder: number },
  right: { id: EntityId; sortOrder: number },
): number {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
}

function referenceTypeOrder(type: MediaAssetReferenceType): number {
  switch (type) {
    case 'scrapbook-cover': return 0;
    case 'scrapbook-legacy-cover': return 1;
    case 'scrapbook-highlight': return 2;
    case 'scrapbook-block': return 3;
  }
}
