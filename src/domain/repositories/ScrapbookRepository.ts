import type { EntityId } from '../models/common';
import type { MediaAsset, MediaAssetBlob, Scrapbook, ScrapbookBlock, ScrapbookPage } from '../models/scrapbook';
import type { BaseRepository } from './BaseRepository';

export interface ScrapbookRepository extends BaseRepository<Scrapbook> {
  getByTripId(tripId: EntityId): Promise<Scrapbook | undefined>;
  listRecent(limit: number): Promise<Scrapbook[]>;
}

export interface ScrapbookPageRepository extends BaseRepository<ScrapbookPage> {
  listByScrapbookId(scrapbookId: EntityId): Promise<ScrapbookPage[]>;
}

export interface ScrapbookBlockRepository extends BaseRepository<ScrapbookBlock> {
  listByPageId(pageId: EntityId): Promise<ScrapbookBlock[]>;
}

export interface MediaAssetRepository extends BaseRepository<MediaAsset> {
  listByTripId(tripId: EntityId): Promise<MediaAsset[]>;
}

export interface MediaAssetBlobRepository {
  getById(id: EntityId): Promise<MediaAssetBlob | undefined>;
  save(blob: MediaAssetBlob): Promise<MediaAssetBlob>;
  deleteByAssetId(assetId: EntityId): Promise<void>;
}
