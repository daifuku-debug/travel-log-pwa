import type { EntityId, IsoDateTimeString } from './common';

export type SyncOperationType = 'create' | 'update' | 'delete';

export interface SyncOperation {
  id: EntityId;
  entityType: string;
  entityId: EntityId;
  operation: SyncOperationType;
  payload: unknown;
  createdAt: IsoDateTimeString;
  syncedAt?: IsoDateTimeString;
  retryCount: number;
}
