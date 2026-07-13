import type { BaseEntity, EntityId } from '../models/common';

export interface BaseRepository<T extends BaseEntity> {
  list(): Promise<T[]>;
  getById(id: EntityId): Promise<T | undefined>;
  save(entity: T): Promise<T>;
  softDelete(id: EntityId): Promise<void>;
}
