import type { BaseEntity, EntityId } from './common';

export type WishlistStatus = 'want' | 'bought' | 'skipped';

export interface WishlistItem extends BaseEntity {
  tripId?: EntityId;
  name: string;
  shopName?: string;
  price?: number;
  url?: string;
  memo?: string;
  status: WishlistStatus;
}
