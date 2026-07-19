import type { ScrapbookPage } from '../../domain/models/scrapbook';

export function sortVisibleScrapbookPages<T extends Pick<ScrapbookPage, 'id' | 'isHidden' | 'sortOrder'>>(pages: T[]): T[] {
  return [...pages]
    .filter((page) => !page.isHidden)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}
