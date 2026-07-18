import type { Collection, CollectionCategory, CollectionItem } from '../../domain/models/collection';
import type { EntityId } from '../../domain/models/common';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { grantCollectionItemExperience, refreshRpgProgress } from '../rpg/rpgProgressService';

const LOCAL_USER_ID = 'local-user';

export interface CollectionInput {
  name: string;
  category: CollectionCategory;
  description: string;
}

export interface CollectionItemInput {
  name: string;
  prefecture: string;
  country: string;
  address: string;
  officialUrl: string;
  memo: string;
}

export async function listCollectionsWithProgress() {
  try {
    await bootstrapAppData();
    return repositories.collections.listWithProgress();
  } catch (error) {
    throw toAppError(error, 'コレクションの読み込みに失敗しました');
  }
}

export async function createCollection(input: CollectionInput): Promise<Collection> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateCollectionInput(input));
    const now = new Date().toISOString();
    return repositories.collections.save({
      id: createId('collection'),
      userId: LOCAL_USER_ID,
      name: input.name.trim(),
      category: input.category,
      description: optionalText(input.description),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, 'コレクションの作成に失敗しました');
  }
}

export async function updateCollection(collectionId: EntityId, input: CollectionInput): Promise<Collection> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateCollectionInput(input));
    const current = await repositories.collections.getById(collectionId);
    if (!current) throw new Error('コレクションが見つかりません。');
    return repositories.collections.save({
      ...current,
      name: input.name.trim(),
      category: input.category,
      description: optionalText(input.description),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, 'コレクションの更新に失敗しました');
  }
}

export async function deleteCollection(collectionId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    const items = await repositories.collectionItems.listByCollectionId(collectionId);
    await Promise.all(
      items.map(async (item) => {
        const visits = await repositories.collectionVisits.listByCollectionItemId(item.id);
        await Promise.all(visits.map((visit) => repositories.collectionVisits.softDelete(visit.id)));
        await repositories.collectionItems.softDelete(item.id);
      }),
    );
    await repositories.collections.softDelete(collectionId);
  } catch (error) {
    throw toAppError(error, 'コレクションの削除に失敗しました');
  }
}

export async function createCollectionItem(
  collectionId: EntityId,
  input: CollectionItemInput,
): Promise<CollectionItem> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateCollectionItemInput(input));
    const collection = await repositories.collections.getById(collectionId);
    if (!collection) throw new Error('コレクションが見つかりません。');
    const now = new Date().toISOString();
    return repositories.collectionItems.save({
      id: createId('collection-item'),
      userId: LOCAL_USER_ID,
      collectionId,
      name: input.name.trim(),
      prefecture: optionalText(input.prefecture),
      country: optionalText(input.country),
      address: optionalText(input.address),
      officialUrl: optionalText(input.officialUrl),
      memo: optionalText(input.memo),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, 'コレクション項目の作成に失敗しました');
  }
}

export async function updateCollectionItem(
  itemId: EntityId,
  input: CollectionItemInput,
): Promise<CollectionItem> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateCollectionItemInput(input));
    const current = await repositories.collectionItems.getById(itemId);
    if (!current) throw new Error('コレクション項目が見つかりません。');
    return repositories.collectionItems.save({
      ...current,
      name: input.name.trim(),
      prefecture: optionalText(input.prefecture),
      country: optionalText(input.country),
      address: optionalText(input.address),
      officialUrl: optionalText(input.officialUrl),
      memo: optionalText(input.memo),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  } catch (error) {
    throw toAppError(error, 'コレクション項目の更新に失敗しました');
  }
}

export async function deleteCollectionItem(itemId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    const visits = await repositories.collectionVisits.listByCollectionItemId(itemId);
    await Promise.all(visits.map((visit) => repositories.collectionVisits.softDelete(visit.id)));
    await repositories.collectionItems.softDelete(itemId);
  } catch (error) {
    throw toAppError(error, 'コレクション項目の削除に失敗しました');
  }
}

export async function setCollectionItemVisited(itemId: EntityId, visited: boolean): Promise<void> {
  try {
    await bootstrapAppData();
    const item = await repositories.collectionItems.getById(itemId);
    if (!item) throw new Error('コレクション項目が見つかりません。');
    const visits = await repositories.collectionVisits.listByCollectionItemId(itemId);
    if (visited && visits.length === 0) {
      const now = new Date().toISOString();
      await repositories.collectionVisits.save({
        id: createId('collection-visit'),
        userId: LOCAL_USER_ID,
        collectionItemId: itemId,
        visitedAt: now,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
      });
      await grantCollectionItemExperience(item.id, item.name);
    }
    if (!visited) {
      await Promise.all(visits.map((visit) => repositories.collectionVisits.softDelete(visit.id)));
    }
    await refreshRpgProgress();
  } catch (error) {
    throw toAppError(error, '訪問済み状態の更新に失敗しました');
  }
}

export function validateCollectionInput(input: CollectionInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('コレクション名を入力してください。');
  return errors;
}

export function validateCollectionItemInput(input: CollectionItemInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('項目名を入力してください。');
  if (input.officialUrl.trim() && !/^https?:\/\//.test(input.officialUrl.trim())) {
    errors.push('公式URLは http:// または https:// で入力してください。');
  }
  return errors;
}

function assertNoValidationErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export async function listCollectionDetails() {
  try {
    await bootstrapAppData();
    const collections = await repositories.collections.listWithProgress();
    return Promise.all(
      collections.map(async (collection) => {
        const items = await repositories.collectionItems.listByCollectionId(collection.id);
        const itemDetails = await Promise.all(
          items.map(async (item) => {
            const visits = await repositories.collectionVisits.listByCollectionItemId(item.id);
            return {
              item,
              visits,
              isVisited: visits.length > 0,
              lastVisitedAt: visits
                .slice()
                .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))[0]?.visitedAt,
            };
          }),
        );
        return {
          ...collection,
          items: itemDetails.sort((a, b) => a.item.name.localeCompare(b.item.name, 'ja')),
        };
      }),
    );
  } catch (error) {
    throw toAppError(error, 'コレクション内訳の読み込みに失敗しました');
  }
}
