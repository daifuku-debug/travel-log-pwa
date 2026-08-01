import {
  collectMediaAssetReferencesFromScrapbookGraph,
  sortMediaAssetReferences,
  type MediaAssetReference,
} from '../../domain/media/mediaAssetReferences.ts';
import type { EntityId } from '../../domain/models/common.ts';
import type {
  MediaAssetRepository,
  ScrapbookBlockRepository,
  ScrapbookPageRepository,
  ScrapbookRepository,
} from '../../domain/repositories/ScrapbookRepository.ts';
import { AppError } from '../../shared/errors.ts';

export interface FindMediaAssetReferencesInput {
  assetId: EntityId;
  tripId?: EntityId;
}

export interface MediaAssetReferenceDependencies {
  mediaAssets: Pick<MediaAssetRepository, 'getById'>;
  scrapbooks: Pick<ScrapbookRepository, 'list'>;
  scrapbookPages: Pick<ScrapbookPageRepository, 'listByScrapbookId'>;
  scrapbookBlocks: Pick<ScrapbookBlockRepository, 'listByPageId'>;
}

export async function findMediaAssetReferencesWithDependencies(
  input: FindMediaAssetReferencesInput,
  dependencies: MediaAssetReferenceDependencies,
): Promise<MediaAssetReference[]> {
  const tripId = input.tripId ?? await resolveAssetTripId(input.assetId, dependencies);
  const scrapbooks = await loadScrapbooks(dependencies);
  const targets = scrapbooks
    .filter((scrapbook) => !scrapbook.deletedAt)
    .filter((scrapbook) => !tripId || scrapbook.tripId === tripId)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  const references: MediaAssetReference[] = [];

  for (const scrapbook of targets) {
    const pages = await loadPages(scrapbook.id, dependencies);
    const pagesWithBlocks = [];
    for (const page of pages) {
      if (page.deletedAt) continue;
      pagesWithBlocks.push({
        page,
        blocks: await loadBlocks(page.id, dependencies),
      });
    }
    references.push(...collectMediaAssetReferencesFromScrapbookGraph({
      scrapbook,
      pages: pagesWithBlocks,
    }, input.assetId));
  }

  return sortMediaAssetReferences(references);
}

async function resolveAssetTripId(
  assetId: EntityId,
  dependencies: MediaAssetReferenceDependencies,
): Promise<EntityId | undefined> {
  try {
    return (await dependencies.mediaAssets.getById(assetId))?.tripId;
  } catch (error) {
    throw new AppError('写真情報の取得中に参照検索が失敗しました。', error);
  }
}

async function loadScrapbooks(dependencies: MediaAssetReferenceDependencies) {
  try {
    return await dependencies.scrapbooks.list();
  } catch (error) {
    throw new AppError('スクラップブック一覧の取得中に参照検索が失敗しました。', error);
  }
}

async function loadPages(
  scrapbookId: EntityId,
  dependencies: MediaAssetReferenceDependencies,
) {
  try {
    return await dependencies.scrapbookPages.listByScrapbookId(scrapbookId);
  } catch (error) {
    throw new AppError(`スクラップブック ${scrapbookId} のページ取得中に参照検索が失敗しました。`, error);
  }
}

async function loadBlocks(
  pageId: EntityId,
  dependencies: MediaAssetReferenceDependencies,
) {
  try {
    return await dependencies.scrapbookBlocks.listByPageId(pageId);
  } catch (error) {
    throw new AppError(`ページ ${pageId} のブロック取得中に参照検索が失敗しました。`, error);
  }
}
