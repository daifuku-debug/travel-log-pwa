import type { EntityId } from '../../domain/models/common';
import type { WishlistItem, WishlistStatus } from '../../domain/models/wishlist';
import { repositories } from '../../infrastructure/repositories/repositoryFactory';
import { toAppError } from '../../shared/errors';
import { createId } from '../../shared/id';
import { bootstrapAppData } from '../bootstrap/bootstrapService';
import { refreshRpgProgress } from '../rpg/rpgProgressService';

const LOCAL_USER_ID = 'local-user';

export interface WishlistItemInput {
  name: string;
  shopName: string;
  price: string;
  url: string;
  memo: string;
  status: WishlistStatus;
}

export async function listWishlistItems(): Promise<WishlistItem[]> {
  try {
    await bootstrapAppData();
    const items = await repositories.wishlist.list();
    return items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    throw toAppError(error, '欲しいものメモの読み込みに失敗しました');
  }
}

export function validateWishlistItemInput(input: WishlistItemInput): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('商品名を入力してください。');
  if (input.price && (!Number.isFinite(Number(input.price)) || Number(input.price) < 0)) {
    errors.push('価格は0以上の数値で入力してください。');
  }
  if (input.url && !isLikelyUrl(input.url)) {
    errors.push('URLは http:// または https:// で始まる形式にしてください。');
  }
  if (!['want', 'bought', 'skipped'].includes(input.status)) {
    errors.push('状態が不正です。');
  }
  return errors;
}

export async function createWishlistItem(input: WishlistItemInput): Promise<WishlistItem> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateWishlistItemInput(input));
    const now = new Date().toISOString();
    const item = await repositories.wishlist.save({
      ...buildWishlistItemFields(input),
      id: createId('wishlist'),
      userId: LOCAL_USER_ID,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    await refreshRpgProgress();
    return item;
  } catch (error) {
    throw toAppError(error, '欲しいものメモの追加に失敗しました');
  }
}

export async function updateWishlistItem(itemId: EntityId, input: WishlistItemInput): Promise<WishlistItem> {
  try {
    await bootstrapAppData();
    assertNoValidationErrors(validateWishlistItemInput(input));
    const current = await repositories.wishlist.getById(itemId);
    if (!current) throw new Error('欲しいものメモが見つかりません。');
    const item = await repositories.wishlist.save({
      ...current,
      ...buildWishlistItemFields(input),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
    await refreshRpgProgress();
    return item;
  } catch (error) {
    throw toAppError(error, '欲しいものメモの更新に失敗しました');
  }
}

export async function deleteWishlistItem(itemId: EntityId): Promise<void> {
  try {
    await bootstrapAppData();
    await repositories.wishlist.softDelete(itemId);
    await refreshRpgProgress();
  } catch (error) {
    throw toAppError(error, '欲しいものメモの削除に失敗しました');
  }
}

function buildWishlistItemFields(input: WishlistItemInput): Pick<WishlistItem, 'name' | 'shopName' | 'price' | 'url' | 'memo' | 'status'> {
  return {
    name: input.name.trim(),
    shopName: optionalText(input.shopName),
    price: optionalNumber(input.price),
    url: optionalText(input.url),
    memo: optionalText(input.memo),
    status: input.status,
  };
}

function assertNoValidationErrors(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join('\n'));
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}
