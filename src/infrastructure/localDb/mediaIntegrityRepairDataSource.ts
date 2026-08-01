import type { EntityId } from '../../domain/models/common.ts';
import type { MediaAsset, MediaAssetBlob } from '../../domain/models/scrapbook.ts';
import { deleteManyById, putOne, readAll, readById } from './db.ts';

export const localMediaIntegrityRepairDataSource = {
  getMediaAssetRaw: (id: EntityId) => readById<MediaAsset>('mediaAssets', id),
  listMediaAssetsRaw: () => readAll<MediaAsset>('mediaAssets'),
  saveMediaAssetRaw: (asset: MediaAsset) => putOne('mediaAssets', asset),
  getMediaAssetBlobRaw: (id: EntityId) => readById<MediaAssetBlob>('mediaAssetBlobs', id),
  saveMediaAssetBlobRaw: (blob: MediaAssetBlob) => putOne('mediaAssetBlobs', blob),
  deleteMediaAssetBlobById: (id: EntityId) => deleteManyById('mediaAssetBlobs', [id]),
  deleteMediaAssetBlobsByAssetId: (assetId: EntityId) => deleteManyById('mediaAssetBlobs', [
    `${assetId}:original`,
    `${assetId}:thumbnail`,
  ]),
};
