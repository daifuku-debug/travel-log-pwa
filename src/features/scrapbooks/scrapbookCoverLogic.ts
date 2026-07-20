import type { EntityId } from '../../domain/models/common';
import type { Scrapbook, ScrapbookBlock, ScrapbookPage } from '../../domain/models/scrapbook';

interface CoverPhotoPage extends ScrapbookPage {
  blocks: ScrapbookBlock[];
}

export function resolveScrapbookCoverPhotoId(
  scrapbook: Scrapbook,
  pages: CoverPhotoPage[],
  availableAssetIds: Iterable<EntityId>,
): EntityId | undefined {
  const available = new Set(availableAssetIds);
  const preferredIds = [
    scrapbook.coverSettings?.photoId,
    scrapbook.coverAssetId,
    ...(scrapbook.highlightPhotoIds ?? []),
  ];

  for (const id of preferredIds) {
    if (id && available.has(id)) return id;
  }

  const sortedPages = [...pages].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  for (const page of sortedPages) {
    const blocks = [...page.blocks]
      .filter((block) => !block.isHidden)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
    for (const block of blocks) {
      if (block.type === 'photo' && available.has(block.assetId)) return block.assetId;
      if (block.type === 'photo_grid') {
        const id = block.assetIds.find((assetId) => available.has(assetId));
        if (id) return id;
      }
    }
  }
  return undefined;
}
