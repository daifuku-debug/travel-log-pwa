import type { BaseEntity, EntityId, IsoDateString, IsoDateTimeString } from './common';

export type ScrapbookStatus = 'draft' | 'completed' | 'archived';
export type ScrapbookLayoutMode = 'timeline' | 'pages' | 'freeform';
export type ScrapbookThemeId = 'classic' | 'journal' | 'minimal' | 'adventure';
export type ScrapbookCoverLayout = 'magazine' | 'journal' | 'photo';
export type ScrapbookPageLayoutType = 'cover' | 'day' | 'section' | 'summary';
export type MediaStorageType = 'local' | 'remote' | 'external';
export type MediaSyncStatus = 'local_only' | 'pending' | 'synced' | 'failed';

export interface Scrapbook extends BaseEntity {
  tripId: EntityId;
  title: string;
  subtitle?: string;
  coverAssetId?: EntityId;
  coverLayout: ScrapbookCoverLayout;
  themeId: ScrapbookThemeId;
  layoutMode: ScrapbookLayoutMode;
  status: ScrapbookStatus;
  isFavorite: boolean;
  publishedAt?: IsoDateTimeString;
  version: number;
}

export interface ScrapbookPage extends BaseEntity {
  scrapbookId: EntityId;
  title: string;
  date?: IsoDateString;
  dayNumber?: number;
  sortOrder: number;
  layoutType: ScrapbookPageLayoutType;
  backgroundStyle?: string;
  sourceType?: 'manual' | 'trip';
  sourceId?: EntityId;
  sourceKey?: string;
  generatedAt?: IsoDateTimeString;
}

export type ScrapbookBlockType =
  | 'text'
  | 'heading'
  | 'photo'
  | 'photo_grid'
  | 'place'
  | 'meal'
  | 'ticket'
  | 'purchase'
  | 'quote'
  | 'divider'
  | 'trip_summary'
  | 'rpg_result';

interface ScrapbookBlockBase extends BaseEntity {
  pageId: EntityId;
  sortOrder: number;
  sourceType?: 'manual' | 'trip' | 'place' | 'media' | 'rpg';
  sourceId?: EntityId;
  sourceKey?: string;
  generatedAt?: IsoDateTimeString;
}

export interface TextBlock extends ScrapbookBlockBase {
  type: 'text';
  text: string;
  textStyle: 'body' | 'memo' | 'list';
}

export interface HeadingBlock extends ScrapbookBlockBase {
  type: 'heading';
  text: string;
  level: 2 | 3;
}

export interface PhotoBlock extends ScrapbookBlockBase {
  type: 'photo';
  assetId: EntityId;
  body?: string;
  caption?: string;
  note?: string;
  altText?: string;
  displaySize: 'large' | 'medium' | 'small';
}

export interface PhotoGridBlock extends ScrapbookBlockBase {
  type: 'photo_grid';
  assetIds: EntityId[];
  body?: string;
  caption?: string;
  note?: string;
  columns: 2 | 3 | 4;
}

export interface PlaceBlock extends ScrapbookBlockBase {
  type: 'place';
  locationId: EntityId;
  titleOverride?: string;
  body?: string;
  caption?: string;
  note?: string;
  snapshotName: string;
}

export interface MealBlock extends ScrapbookBlockBase {
  type: 'meal';
  name: string;
  body?: string;
  restaurantName?: string;
  eatenAt?: IsoDateTimeString;
  locationId?: EntityId;
  assetIds: EntityId[];
  rating?: number;
  price?: number;
  note?: string;
  isBestMeal: boolean;
}

export interface TicketBlock extends ScrapbookBlockBase {
  type: 'ticket';
  assetId?: EntityId;
  itemType: 'ticket' | 'receipt' | 'pamphlet' | 'stamp' | 'goshuin' | 'castle_stamp' | 'other';
  title: string;
  body?: string;
  issuedAt?: IsoDateString;
  note?: string;
  relatedLocationId?: EntityId;
  relatedCollectionItemId?: EntityId;
}

export interface PurchaseBlock extends ScrapbookBlockBase {
  type: 'purchase';
  name: string;
  body?: string;
  shopName?: string;
  price?: number;
  purchasedAt?: IsoDateString;
  assetIds: EntityId[];
  note?: string;
  category?: string;
  relatedWishlistItemId?: EntityId;
}

export interface QuoteBlock extends ScrapbookBlockBase {
  type: 'quote';
  text: string;
  cite?: string;
}

export interface DividerBlock extends ScrapbookBlockBase {
  type: 'divider';
  label?: string;
}

export interface TripSummaryBlock extends ScrapbookBlockBase {
  type: 'trip_summary';
  title?: string;
  body?: string;
}

export interface RpgResultBlock extends ScrapbookBlockBase {
  type: 'rpg_result';
  tripId: EntityId;
  title?: string;
}

export type ScrapbookBlock =
  | TextBlock
  | HeadingBlock
  | PhotoBlock
  | PhotoGridBlock
  | PlaceBlock
  | MealBlock
  | TicketBlock
  | PurchaseBlock
  | QuoteBlock
  | DividerBlock
  | TripSummaryBlock
  | RpgResultBlock;

export interface MediaAsset extends BaseEntity {
  tripId: EntityId;
  storageType: MediaStorageType;
  localReference?: string;
  remoteKey?: string;
  thumbnailReference?: string;
  mimeType: string;
  width?: number;
  height?: number;
  fileSize?: number;
  originalFileName?: string;
  takenAt?: IsoDateTimeString;
  latitude?: number;
  longitude?: number;
  uploadedAt?: IsoDateTimeString;
  mediaSyncStatus: MediaSyncStatus;
}

export interface MediaAssetBlob {
  id: EntityId;
  assetId: EntityId;
  kind: 'original' | 'thumbnail';
  blob: Blob;
  mimeType: string;
  createdAt: IsoDateTimeString;
}
