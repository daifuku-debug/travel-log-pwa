export type EntityId = string;
export type IsoDateString = string;
export type IsoDateTimeString = string;

export type SyncStatus = 'synced' | 'pending' | 'conflict';

export interface BaseEntity {
  id: EntityId;
  userId: EntityId;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  deletedAt?: IsoDateTimeString;
  syncStatus: SyncStatus;
}
