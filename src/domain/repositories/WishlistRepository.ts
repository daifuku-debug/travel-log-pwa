import type { EntityId } from '../models/common';
import type { WishlistItem } from '../models/wishlist';
import type { BaseRepository } from './BaseRepository';

export interface WishlistRepository extends BaseRepository<WishlistItem> {
  listByTripId(tripId: EntityId): Promise<WishlistItem[]>;
}
