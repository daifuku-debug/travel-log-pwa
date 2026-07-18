import type { EntityId } from '../../domain/models/common';
import type { MediaAsset, Scrapbook, ScrapbookBlock, ScrapbookPage } from '../../domain/models/scrapbook';
import type {
  MediaAssetRepository,
  ScrapbookBlockRepository,
  ScrapbookPageRepository,
  ScrapbookRepository,
} from '../../domain/repositories/ScrapbookRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalScrapbookRepository extends LocalBaseRepository<Scrapbook> implements ScrapbookRepository {
  constructor() {
    super('scrapbooks');
  }

  async getByTripId(tripId: EntityId): Promise<Scrapbook | undefined> {
    const scrapbooks = await this.list();
    return scrapbooks.find((scrapbook) => scrapbook.tripId === tripId);
  }

  async listRecent(limit: number): Promise<Scrapbook[]> {
    const scrapbooks = await this.list();
    return scrapbooks
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }
}

export class LocalScrapbookPageRepository
  extends LocalBaseRepository<ScrapbookPage>
  implements ScrapbookPageRepository
{
  constructor() {
    super('scrapbookPages');
  }

  async listByScrapbookId(scrapbookId: EntityId): Promise<ScrapbookPage[]> {
    const pages = await this.list();
    return pages
      .filter((page) => page.scrapbookId === scrapbookId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

export class LocalScrapbookBlockRepository
  extends LocalBaseRepository<ScrapbookBlock>
  implements ScrapbookBlockRepository
{
  constructor() {
    super('scrapbookBlocks');
  }

  async listByPageId(pageId: EntityId): Promise<ScrapbookBlock[]> {
    const blocks = await this.list();
    return blocks
      .filter((block) => block.pageId === pageId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

export class LocalMediaAssetRepository extends LocalBaseRepository<MediaAsset> implements MediaAssetRepository {
  constructor() {
    super('mediaAssets');
  }

  async listByTripId(tripId: EntityId): Promise<MediaAsset[]> {
    const assets = await this.list();
    return assets
      .filter((asset) => asset.tripId === tripId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
