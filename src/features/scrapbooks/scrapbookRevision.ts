import type { EntityId } from '../../domain/models/common';
import type { Scrapbook } from '../../domain/models/scrapbook';

export interface GeneratedScrapbookFields {
  title: string;
  subtitle?: string;
}

export function mergeGeneratedScrapbookFields(
  current: Scrapbook,
  generated: GeneratedScrapbookFields,
  sourceRevision: number,
): Scrapbook {
  const editedFields = new Set(current.userEditedFields ?? []);
  return {
    ...current,
    title: editedFields.has('title') ? current.title : generated.title,
    subtitle: editedFields.has('subtitle') ? current.subtitle : generated.subtitle,
    sourceRevision,
  };
}

export function collectScrapbookMediaAssetIds(scrapbook: Scrapbook): EntityId[] {
  return [...new Set([
    scrapbook.coverSettings?.photoId,
    scrapbook.coverAssetId,
    ...(scrapbook.highlightPhotoIds ?? []),
  ].filter((id): id is EntityId => Boolean(id)))];
}

export function appendEditedFields(current: string[] | undefined, changed: string[]): string[] {
  return [...new Set([...(current ?? []), ...changed])];
}
