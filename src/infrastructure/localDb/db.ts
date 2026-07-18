import { AppError } from '../../shared/errors';

const DB_NAME = 'travel-log-local-db';
const DB_VERSION = 6;

export type StoreName =
  | 'trips'
  | 'placeVisits'
  | 'wishlistItems'
  | 'collections'
  | 'collectionItems'
  | 'collectionVisits'
  | 'prefectureVisits'
  | 'tripPrefectureVisits'
  | 'castleVisitSummaries'
  | 'castleVisitEvents'
  | 'scrapbooks'
  | 'scrapbookPages'
  | 'scrapbookBlocks'
  | 'mediaAssets'
  | 'mediaAssetBlobs'
  | 'rpgExperienceEntries'
  | 'userRpgTitles'
  | 'userRpgAchievements'
  | 'rpgQuests'
  | 'tripRpgResults'
  | 'rpgSettings'
  | 'syncOperations'
  | 'meta';

const STORE_NAMES: StoreName[] = [
  'trips',
  'placeVisits',
  'wishlistItems',
  'collections',
  'collectionItems',
  'collectionVisits',
  'prefectureVisits',
  'tripPrefectureVisits',
  'castleVisitSummaries',
  'castleVisitEvents',
  'scrapbooks',
  'scrapbookPages',
  'scrapbookBlocks',
  'mediaAssets',
  'mediaAssetBlobs',
  'rpgExperienceEntries',
  'userRpgTitles',
  'userRpgAchievements',
  'rpgQuests',
  'tripRpgResults',
  'rpgSettings',
  'syncOperations',
  'meta',
];

let dbPromise: Promise<IDBDatabase> | undefined;

export function getLocalDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName of STORE_NAMES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new AppError('端末内データベースを開けませんでした', request.error));
    });
  }

  return dbPromise;
}

export async function readAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await getLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(new AppError('端末内データの読み込みに失敗しました', request.error));
  });
}

export async function readById<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  const db = await getLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(new AppError('端末内データの読み込みに失敗しました', request.error));
  });
}

export async function putOne<T>(storeName: StoreName, value: T): Promise<T> {
  const db = await getLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(new AppError('端末内データの保存に失敗しました', request.error));
  });
}

export async function putMany<T>(storeName: StoreName, values: T[]): Promise<void> {
  const db = await getLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    values.forEach((value) => store.put(value));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new AppError('端末内データの保存に失敗しました', transaction.error));
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await getLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new AppError('端末内データの削除に失敗しました', request.error));
  });
}
