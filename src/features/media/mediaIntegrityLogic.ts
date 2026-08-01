import {
  buildMediaIntegrityReport,
  type MediaIntegrityReport,
} from '../../domain/media/mediaIntegrity.ts';
import type {
  MediaAsset,
  MediaAssetBlob,
  Scrapbook,
  ScrapbookBlock,
  ScrapbookPage,
} from '../../domain/models/scrapbook.ts';
import { AppError } from '../../shared/errors.ts';

export type MediaIntegrityScanStage =
  | 'media-assets'
  | 'media-asset-blobs'
  | 'scrapbooks'
  | 'scrapbook-pages'
  | 'scrapbook-blocks';

export type MediaIntegrityScanErrorCode = 'partial-read-failure' | 'complete-read-failure';

export interface MediaIntegrityScanDependencies {
  listMediaAssetsRaw: () => Promise<MediaAsset[]>;
  listMediaAssetBlobsRaw: () => Promise<MediaAssetBlob[]>;
  listScrapbooksRaw: () => Promise<Scrapbook[]>;
  listScrapbookPagesRaw: () => Promise<ScrapbookPage[]>;
  listScrapbookBlocksRaw: () => Promise<ScrapbookBlock[]>;
  now?: () => string;
}

export class MediaIntegrityScanError extends AppError {
  readonly code: MediaIntegrityScanErrorCode;
  readonly failedStages: MediaIntegrityScanStage[];
  readonly completedStages: MediaIntegrityScanStage[];

  constructor({
    code,
    failedStages,
    completedStages,
    cause,
  }: {
    code: MediaIntegrityScanErrorCode;
    failedStages: MediaIntegrityScanStage[];
    completedStages: MediaIntegrityScanStage[];
    cause?: unknown;
  }) {
    super(
      code === 'complete-read-failure'
        ? '写真データの診断に必要な情報を取得できませんでした。'
        : '写真データの一部を取得できなかったため、診断結果を作成しませんでした。',
      cause,
    );
    this.name = 'MediaIntegrityScanError';
    this.code = code;
    this.failedStages = failedStages;
    this.completedStages = completedStages;
  }
}

export async function scanMediaAssetIntegrityWithDependencies(
  dependencies: MediaIntegrityScanDependencies,
): Promise<MediaIntegrityReport> {
  const results = await Promise.allSettled([
    dependencies.listMediaAssetsRaw(),
    dependencies.listMediaAssetBlobsRaw(),
    dependencies.listScrapbooksRaw(),
    dependencies.listScrapbookPagesRaw(),
    dependencies.listScrapbookBlocksRaw(),
  ] as const);
  const stages: MediaIntegrityScanStage[] = [
    'media-assets',
    'media-asset-blobs',
    'scrapbooks',
    'scrapbook-pages',
    'scrapbook-blocks',
  ];
  const failedStages = stages.filter((_, index) => results[index].status === 'rejected');
  const completedStages = stages.filter((_, index) => results[index].status === 'fulfilled');

  if (failedStages.length > 0) {
    const firstFailure = results.find((result) => result.status === 'rejected');
    throw new MediaIntegrityScanError({
      code: completedStages.length === 0 ? 'complete-read-failure' : 'partial-read-failure',
      failedStages,
      completedStages,
      cause: firstFailure?.status === 'rejected' ? firstFailure.reason : undefined,
    });
  }

  return buildMediaIntegrityReport({
    mediaAssets: fulfilledValue(results[0]),
    mediaAssetBlobs: fulfilledValue(results[1]),
    scrapbooks: fulfilledValue(results[2]),
    scrapbookPages: fulfilledValue(results[3]),
    scrapbookBlocks: fulfilledValue(results[4]),
  }, (dependencies.now ?? (() => new Date().toISOString()))());
}

function fulfilledValue<T>(result: PromiseSettledResult<T>): T {
  if (result.status !== 'fulfilled') throw new Error('Integrity scan stage was not fulfilled');
  return result.value;
}
