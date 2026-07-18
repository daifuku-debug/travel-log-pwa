import type { EntityId, IsoDateString } from '../../domain/models/common';
import type { ManualTimelineEntry } from '../../domain/models/timeMachine';
import type { ManualTimelineEntryRepository } from '../../domain/repositories/TimeMachineRepository';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalManualTimelineEntryRepository
  extends LocalBaseRepository<ManualTimelineEntry>
  implements ManualTimelineEntryRepository
{
  constructor() {
    super('manualTimelineEntries');
  }

  async listByDate(date: IsoDateString): Promise<ManualTimelineEntry[]> {
    const entries = await this.list();
    return entries
      .filter((entry) => entry.date === date)
      .sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));
  }

  async listByTripId(tripId: EntityId): Promise<ManualTimelineEntry[]> {
    const entries = await this.list();
    return entries.filter((entry) => entry.tripId === tripId);
  }
}
