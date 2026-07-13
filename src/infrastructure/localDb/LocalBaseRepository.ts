import type { BaseEntity, EntityId } from '../../domain/models/common';
import type { BaseRepository } from '../../domain/repositories/BaseRepository';
import { putOne, readAll, readById, type StoreName } from './db';

export class LocalBaseRepository<T extends BaseEntity> implements BaseRepository<T> {
  constructor(private readonly storeName: StoreName) {}

  async list(): Promise<T[]> {
    const entities = await readAll<T>(this.storeName);
    return entities.filter((entity) => !entity.deletedAt);
  }

  async getById(id: EntityId): Promise<T | undefined> {
    const entity = await readById<T>(this.storeName, id);
    return entity?.deletedAt ? undefined : entity;
  }

  async save(entity: T): Promise<T> {
    return putOne(this.storeName, entity);
  }

  async softDelete(id: EntityId): Promise<void> {
    const entity = await readById<T>(this.storeName, id);
    if (!entity) return;
    await putOne(this.storeName, {
      ...entity,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
  }
}
