import { LocalCollectionRepository, LocalCollectionItemRepository, LocalCollectionVisitRepository } from '../localDb/LocalCollectionRepository';
import { LocalPlaceVisitRepository, LocalTripRepository } from '../localDb/LocalTripRepository';
import { LocalWishlistRepository } from '../localDb/LocalWishlistRepository';

const collectionItemRepository = new LocalCollectionItemRepository();
const collectionVisitRepository = new LocalCollectionVisitRepository();

export const repositories = {
  trips: new LocalTripRepository(),
  placeVisits: new LocalPlaceVisitRepository(),
  wishlist: new LocalWishlistRepository(),
  collections: new LocalCollectionRepository(collectionItemRepository, collectionVisitRepository),
  collectionItems: collectionItemRepository,
  collectionVisits: collectionVisitRepository,
};
