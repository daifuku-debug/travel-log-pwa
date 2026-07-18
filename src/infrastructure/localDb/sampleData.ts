import type { Collection, CollectionItem, CollectionVisit } from '../../domain/models/collection';
import type { PlaceVisit, Trip } from '../../domain/models/trip';
import type { WishlistItem } from '../../domain/models/wishlist';
import { putMany, putOne, readById } from './db';

const USER_ID = 'local-user';
const now = '2026-07-12T12:00:00.000Z';

export const SAMPLE_TRIP_IDS = ['trip-kyoto-2026', 'trip-kanazawa-2026'];
export const SAMPLE_PLACE_VISIT_IDS = ['place-kyoto-station', 'place-kanazawa-castle'];
export const SAMPLE_COLLECTION_VISIT_IDS = ['collection-visit-kanazawa-castle', 'collection-visit-kyoto-station'];
export const SAMPLE_COLLECTION_IDS = ['collection-castles', 'collection-stations'];
export const SAMPLE_COLLECTION_ITEM_IDS = ['collection-item-kanazawa-castle', 'collection-item-kyoto-station', 'collection-item-tokyo-station'];
export const SAMPLE_WISHLIST_ITEM_IDS = ['wish-kanazawa-tea'];

const trips: Trip[] = [
  {
    id: 'trip-kyoto-2026',
    userId: USER_ID,
    title: '京都 日帰り散歩',
    startDate: '2026-06-08',
    endDate: '2026-06-08',
    tripType: 'dayTrip',
    companions: ['友人'],
    purpose: '紫陽花と喫茶店めぐり',
    memo: '雨上がりで歩きやすかった。',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
  {
    id: 'trip-kanazawa-2026',
    userId: USER_ID,
    title: '金沢 週末旅行',
    startDate: '2026-05-18',
    endDate: '2026-05-19',
    tripType: 'overnight',
    companions: ['家族'],
    purpose: '城と市場',
    memo: '次回は21世紀美術館を長めに見る。',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
];

const placeVisits: PlaceVisit[] = [
  {
    id: 'place-kyoto-station',
    userId: USER_ID,
    tripId: 'trip-kyoto-2026',
    name: '京都駅',
    visitedAt: '2026-06-08T09:20:00.000Z',
    memo: '朝の集合場所。',
    collectionItemIds: ['collection-item-kyoto-station'],
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
  {
    id: 'place-kanazawa-castle',
    userId: USER_ID,
    tripId: 'trip-kanazawa-2026',
    name: '金沢城公園',
    visitedAt: '2026-05-18T13:30:00.000Z',
    memo: '石垣がよかった。',
    collectionItemIds: ['collection-item-kanazawa-castle'],
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
];

const wishlistItems: WishlistItem[] = [
  {
    id: 'wish-kanazawa-tea',
    userId: USER_ID,
    tripId: 'trip-kanazawa-2026',
    name: '加賀棒茶',
    shopName: '近江町市場の茶舗',
    memo: '缶入りを次回買う。',
    status: 'want',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
];

const collections: Collection[] = [
  {
    id: 'collection-castles',
    userId: USER_ID,
    name: '城めぐり',
    category: 'castle',
    description: '訪問した城と城跡を記録する。',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
  {
    id: 'collection-stations',
    userId: USER_ID,
    name: '印象に残った駅',
    category: 'station',
    description: '旅の起点になった駅の記録。',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
];

const collectionItems: CollectionItem[] = [
  {
    id: 'collection-item-kanazawa-castle',
    userId: USER_ID,
    collectionId: 'collection-castles',
    name: '金沢城',
    prefecture: '石川県',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
  {
    id: 'collection-item-kyoto-station',
    userId: USER_ID,
    collectionId: 'collection-stations',
    name: '京都駅',
    prefecture: '京都府',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
  {
    id: 'collection-item-tokyo-station',
    userId: USER_ID,
    collectionId: 'collection-stations',
    name: '東京駅',
    prefecture: '東京都',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
];

const collectionVisits: CollectionVisit[] = [
  {
    id: 'collection-visit-kanazawa-castle',
    userId: USER_ID,
    collectionItemId: 'collection-item-kanazawa-castle',
    tripId: 'trip-kanazawa-2026',
    placeVisitId: 'place-kanazawa-castle',
    visitedAt: '2026-05-18T13:30:00.000Z',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
  {
    id: 'collection-visit-kyoto-station',
    userId: USER_ID,
    collectionItemId: 'collection-item-kyoto-station',
    tripId: 'trip-kyoto-2026',
    placeVisitId: 'place-kyoto-station',
    visitedAt: '2026-06-08T09:20:00.000Z',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'synced',
  },
];

export async function seedSampleData(): Promise<void> {
  const seeded = await readById<{ id: string; seededAt: string }>('meta', 'sample-data-seeded');
  if (seeded) return;

  await Promise.all([
    putMany('trips', trips),
    putMany('placeVisits', placeVisits),
    putMany('wishlistItems', wishlistItems),
    putMany('collections', collections),
    putMany('collectionItems', collectionItems),
    putMany('collectionVisits', collectionVisits),
  ]);
  await putOne('meta', { id: 'sample-data-seeded', seededAt: new Date().toISOString() });
}
