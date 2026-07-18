import type { EntityId, IsoDateString } from '../models/common';
import type { ManualTimelineEntry } from '../models/timeMachine';
import type { BaseRepository } from './BaseRepository';

export interface ManualTimelineEntryRepository extends BaseRepository<ManualTimelineEntry> {
  listByDate(date: IsoDateString): Promise<ManualTimelineEntry[]>;
  listByTripId(tripId: EntityId): Promise<ManualTimelineEntry[]>;
}
