import type { MediaAssetReference } from './mediaAssetReferences.ts';
import type { EntityId } from '../models/common.ts';
import type { Scrapbook, ScrapbookBlock } from '../models/scrapbook.ts';

export type MediaAssetReferenceGroupKind =
  | 'cover'
  | 'highlight'
  | 'photo'
  | 'photo-grid'
  | 'meal'
  | 'ticket'
  | 'purchase';

export interface MediaAssetReferenceGroup {
  key: string;
  kind: MediaAssetReferenceGroupKind;
  assetId: EntityId;
  scrapbookId: EntityId;
  pageId?: EntityId;
  blockId?: EntityId;
  ownerLabel?: string;
  pageLabel?: string;
  blockLabel?: string;
  occurrenceCount: number;
  fields: MediaAssetReference['field'][];
  detachable: boolean;
  references: MediaAssetReference[];
}

export function groupMediaAssetReferences(
  references: MediaAssetReference[],
): MediaAssetReferenceGroup[] {
  const groups = new Map<string, MediaAssetReferenceGroup>();

  for (const reference of references) {
    const kind = getReferenceGroupKind(reference);
    const key = getMediaAssetReferenceGroupKey(reference);
    const current = groups.get(key);
    if (current) {
      current.references.push(reference);
      current.occurrenceCount += 1;
      if (!current.fields.includes(reference.field)) current.fields.push(reference.field);
      continue;
    }
    groups.set(key, {
      key,
      kind,
      assetId: reference.assetId,
      scrapbookId: reference.scrapbookId,
      pageId: reference.pageId,
      blockId: reference.blockId,
      ownerLabel: reference.ownerLabel,
      pageLabel: reference.pageLabel,
      blockLabel: reference.blockLabel,
      occurrenceCount: 1,
      fields: [reference.field],
      detachable: kind !== 'photo',
      references: [reference],
    });
  }

  return [...groups.values()];
}

export function getMediaAssetReferenceGroupKey(reference: MediaAssetReference): string {
  if (reference.type === 'scrapbook-cover' || reference.type === 'scrapbook-legacy-cover') {
    return `scrapbook:${reference.scrapbookId}:cover`;
  }
  if (reference.type === 'scrapbook-highlight') {
    return `scrapbook:${reference.scrapbookId}:highlight`;
  }
  return `block:${reference.blockId ?? 'unknown'}:${reference.field}`;
}

export function detachMediaAssetFromScrapbook(
  scrapbook: Scrapbook,
  assetId: EntityId,
  selectedKinds: ReadonlySet<'cover' | 'highlight'>,
  now: string,
): Scrapbook {
  let changed = false;
  let next = scrapbook;
  const editedFields = new Set(scrapbook.userEditedFields ?? []);

  if (selectedKinds.has('cover')) {
    const currentPhotoId = scrapbook.coverSettings?.photoId;
    const currentLegacyId = scrapbook.coverAssetId;
    if (currentPhotoId === assetId || currentLegacyId === assetId) {
      next = {
        ...next,
        coverSettings: scrapbook.coverSettings
          ? { ...scrapbook.coverSettings, photoId: undefined }
          : scrapbook.coverSettings,
        coverAssetId: undefined,
      };
      editedFields.add('coverSettings');
      editedFields.add('coverAssetId');
      changed = true;
    }
  }

  if (selectedKinds.has('highlight')) {
    const highlightPhotoIds = scrapbook.highlightPhotoIds?.filter((id) => id !== assetId);
    if ((highlightPhotoIds?.length ?? 0) !== (scrapbook.highlightPhotoIds?.length ?? 0)) {
      next = { ...next, highlightPhotoIds };
      editedFields.add('highlightPhotoIds');
      changed = true;
    }
  }

  if (!changed) return scrapbook;
  return {
    ...next,
    userEditedFields: [...editedFields],
    version: scrapbook.version + 1,
    updatedAt: now,
    syncStatus: 'pending',
  };
}

export function detachMediaAssetFromBlock(
  block: ScrapbookBlock,
  assetId: EntityId,
  now: string,
): ScrapbookBlock | undefined {
  let next: ScrapbookBlock;
  switch (block.type) {
    case 'photo':
      return undefined;
    case 'photo_grid':
    case 'meal':
    case 'purchase': {
      const assetIds = block.assetIds.filter((id) => id !== assetId);
      if (assetIds.length === block.assetIds.length) return block;
      next = { ...block, assetIds };
      break;
    }
    case 'ticket':
      if (block.assetId !== assetId) return block;
      next = { ...block, assetId: undefined };
      break;
    case 'text':
    case 'heading':
    case 'place':
    case 'quote':
    case 'divider':
    case 'trip_summary':
    case 'rpg_result':
      return undefined;
  }

  return {
    ...next,
    userEditedFields: [...new Set([...(block.userEditedFields ?? []), block.type === 'ticket' ? 'assetId' : 'assetIds'])],
    updatedAt: now,
    syncStatus: 'pending',
  };
}

function getReferenceGroupKind(reference: MediaAssetReference): MediaAssetReferenceGroupKind {
  if (reference.type === 'scrapbook-cover' || reference.type === 'scrapbook-legacy-cover') return 'cover';
  if (reference.type === 'scrapbook-highlight') return 'highlight';
  switch (reference.blockType) {
    case 'photo': return 'photo';
    case 'photo_grid': return 'photo-grid';
    case 'meal': return 'meal';
    case 'ticket': return 'ticket';
    case 'purchase': return 'purchase';
    default: return 'photo';
  }
}
