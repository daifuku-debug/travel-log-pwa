import type { EntityId } from '../../domain/models/common';
import type { WishlistItem } from '../../domain/models/wishlist';
import type { WishlistRepository } from '../../domain/repositories/WishlistRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalWishlistRepository
  extends LocalBaseRepository<WishlistItem>
  implements WishlistRepository
{
  constructor() {
    super('wishlistItems');
  }

  async listByTripId(tripId: EntityId): Promise<WishlistItem[]> {
    const items = await this.list();
    return items.filter((item) => item.tripId === tripId);
  }
}
