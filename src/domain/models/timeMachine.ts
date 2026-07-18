import type { BaseEntity, EntityId, IsoDateString, IsoDateTimeString } from './common';

export type TimePrecision = 'exact' | 'minute' | 'hour' | 'day' | 'range' | 'unknown';
export type TimelineConfidence = 'exact' | 'high' | 'medium' | 'low' | 'unknown';

export type TimelineEventType =
  | 'trip_start'
  | 'trip_end'
  | 'visit'
  | 'stay'
  | 'photo'
  | 'castle_visit'
  | 'collection_unlock'
  | 'memo'
  | 'scrapbook'
  | 'achievement'
  | 'title_acquired'
  | 'manual_location';

export type TimelineSourceType =
  | 'trip'
  | 'placeVisit'
  | 'mediaAsset'
  | 'castleVisit'
  | 'collectionVisit'
  | 'scrapbook'
  | 'rpgExperience'
  | 'rpgAchievement'
  | 'rpgTitle'
  | 'manualTimelineEntry';

export interface TimelineEventSource {
  sourceType: TimelineSourceType;
  sourceId: EntityId;
  timestamp?: IsoDateTimeString;
  reliability: TimelineConfidence;
  summary: string;
}

export interface TimelineEvent {
  id: EntityId;
  eventType: TimelineEventType;
  sourceType: TimelineSourceType;
  sourceId: EntityId;
  title: string;
  description?: string;
  startAt?: IsoDateTimeString;
  endAt?: IsoDateTimeString;
  localDate: IsoDateString;
  timezone: string;
  timePrecision: TimePrecision;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  prefectureCode?: string;
  assetIds: EntityId[];
  tripId?: EntityId;
  scrapbookId?: EntityId;
  confidence: TimelineConfidence;
  confidenceReason: string;
  sourcePriority: number;
  sources: TimelineEventSource[];
  detailPath?: string;
}

export interface LocationCandidate {
  eventId: EntityId;
  locationName: string;
  latitude?: number;
  longitude?: number;
  confidence: TimelineConfidence;
  reasons: string[];
}

export interface LocationInferenceResult {
  queryAt?: IsoDateTimeString;
  primaryCandidate?: LocationCandidate;
  candidateLocations: LocationCandidate[];
  confidence: TimelineConfidence;
  reasons: string[];
  conflictingSources: TimelineEventSource[];
  beforeEvent?: TimelineEvent;
  afterEvent?: TimelineEvent;
}

export interface ManualTimelineEntry extends BaseEntity {
  date: IsoDateString;
  startAt?: IsoDateTimeString;
  endAt?: IsoDateTimeString;
  timePrecision: TimePrecision;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
  tripId?: EntityId;
  sourceType: 'manual';
  confidence: TimelineConfidence;
}
