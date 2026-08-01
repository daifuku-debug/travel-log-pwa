import type {
  MediaAsset,
  MediaAssetBlob,
  Scrapbook,
  ScrapbookBlock,
  ScrapbookPage,
} from '../../domain/models/scrapbook.ts';
import { readAll } from './db.ts';

export const localMediaIntegrityDataSource = {
  listMediaAssetsRaw: () => readAll<MediaAsset>('mediaAssets'),
  listMediaAssetBlobsRaw: () => readAll<MediaAssetBlob>('mediaAssetBlobs'),
  listScrapbooksRaw: () => readAll<Scrapbook>('scrapbooks'),
  listScrapbookPagesRaw: () => readAll<ScrapbookPage>('scrapbookPages'),
  listScrapbookBlocksRaw: () => readAll<ScrapbookBlock>('scrapbookBlocks'),
};
