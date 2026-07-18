import type {
  LocationCandidate,
  LocationInferenceResult,
  TimelineConfidence,
  TimelineEvent,
  TimelineEventSource,
} from '../../domain/models/timeMachine';

const SAME_PLACE_DISTANCE_METERS = 250;
const EXACT_MATCH_MINUTES = 20;
const QUERY_WINDOW_HOURS = 2;

export function inferLocationFromTimeline(events: TimelineEvent[], queryAt?: string): LocationInferenceResult {
  const locationEvents = events.filter(hasLocationSignal);
  const timed = locationEvents.filter((event) => event.startAt).sort(compareTimelineEvents);
  const beforeEvent = queryAt ? timed.filter((event) => event.startAt! <= queryAt).at(-1) : undefined;
  const afterEvent = queryAt ? timed.find((event) => event.startAt! > queryAt) : undefined;
  const exactMatches = queryAt
    ? timed.filter((event) => event.startAt && withinMinutes(event.startAt, queryAt, EXACT_MATCH_MINUTES))
    : [];
  const groupedCandidates = buildCandidates(locationEvents, queryAt);
  const conflictingSources = collectConflicts(beforeEvent, afterEvent);

  if (locationEvents.length === 0) {
    return {
      queryAt,
      mode: 'insufficient_data',
      candidateLocations: [],
      confidence: 'unknown',
      reasons: ['この日の場所を示す記録がまだありません。'],
      conflictingSources: [],
      beforeEvent,
      afterEvent,
    };
  }

  if (queryAt && exactMatches.length > 0) {
    const candidates = buildCandidates(exactMatches, queryAt);
    const primaryCandidate = candidates[0];
    return {
      queryAt,
      mode: 'exact_match',
      primaryCandidate,
      candidateLocations: mergeCandidateLists(candidates, groupedCandidates),
      confidence: primaryCandidate?.confidence ?? 'unknown',
      reasons: [
        '指定時刻の近くに記録があります。',
        ...(primaryCandidate?.reasons ?? []),
      ],
      conflictingSources,
      beforeEvent,
      afterEvent,
    };
  }

  if (queryAt && beforeEvent && afterEvent && samePlace(beforeEvent, afterEvent)) {
    const candidate = mergeEventsToCandidate([beforeEvent, afterEvent], queryAt, 'high', [
      '指定時刻の前後が同じ場所の記録です。',
      'その間も同じ場所にいた可能性があります。',
    ]);
    return {
      queryAt,
      mode: 'between_same_place',
      primaryCandidate: candidate,
      candidateLocations: mergeCandidateLists([candidate], groupedCandidates),
      confidence: candidate.confidence,
      reasons: candidate.reasons,
      conflictingSources: [],
      beforeEvent,
      afterEvent,
    };
  }

  if (queryAt && beforeEvent && afterEvent && !samePlace(beforeEvent, afterEvent)) {
    const beforeCandidate = eventToCandidate(beforeEvent, queryAt, ['指定時刻の直前の地点です。']);
    const afterCandidate = eventToCandidate(afterEvent, queryAt, ['指定時刻の直後の地点です。']);
    return {
      queryAt,
      mode: 'moving_between_places',
      primaryCandidate: beforeCandidate,
      candidateLocations: mergeCandidateLists([beforeCandidate, afterCandidate], groupedCandidates),
      confidence: downgradeConfidence(maxConfidence(beforeCandidate.confidence, afterCandidate.confidence)),
      reasons: ['前後の記録が異なる場所のため、移動中または記録誤差の可能性があります。'],
      conflictingSources,
      beforeEvent,
      afterEvent,
    };
  }

  const primaryCandidate = groupedCandidates[0];
  return {
    queryAt,
    mode: 'candidate_list',
    primaryCandidate,
    candidateLocations: groupedCandidates,
    confidence: primaryCandidate?.confidence ?? 'unknown',
    reasons: primaryCandidate ? primaryCandidate.reasons : ['この日の候補地を一覧表示しています。'],
    conflictingSources,
    beforeEvent,
    afterEvent,
  };
}

function buildCandidates(events: TimelineEvent[], queryAt?: string): LocationCandidate[] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = locationKey(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.values()]
    .map((group) => mergeEventsToCandidate(group, queryAt))
    .sort(compareCandidates);
}

function mergeCandidateLists(preferred: LocationCandidate[], fallback: LocationCandidate[]): LocationCandidate[] {
  const merged = new Map<string, LocationCandidate>();
  for (const candidate of [...preferred, ...fallback]) {
    const key = candidate.locationName;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, candidate);
      continue;
    }
    merged.set(key, {
      ...current,
      confidence: maxConfidence(current.confidence, candidate.confidence),
      reasons: [...new Set([...current.reasons, ...candidate.reasons])],
      supportingEventIds: [...new Set([...current.supportingEventIds, ...candidate.supportingEventIds])],
      sourcePriorities: [...current.sourcePriorities, ...candidate.sourcePriorities],
      distanceMinutes: minDefined(current.distanceMinutes, candidate.distanceMinutes),
    });
  }
  return [...merged.values()].sort(compareCandidates);
}

function mergeEventsToCandidate(
  events: TimelineEvent[],
  queryAt?: string,
  forcedConfidence?: TimelineConfidence,
  extraReasons: string[] = [],
): LocationCandidate {
  const representative = events.slice().sort(compareTimelineEvents)[0];
  const sourcePriorities = events.map((event) => event.sourcePriority);
  const bestConfidence = forcedConfidence ?? events.map((event) => adjustConfidenceForTime(event, queryAt)).reduce(maxConfidence, 'unknown');
  const distanceMinutes = queryAt
    ? minDefined(...events.map((event) => event.startAt ? Math.round(Math.abs(new Date(event.startAt).getTime() - new Date(queryAt).getTime()) / 60000) : undefined))
    : undefined;
  const reasons = [
    ...extraReasons,
    ...events.map((event) => event.confidenceReason),
    events.length >= 2 ? `${events.length}件の記録が同じ候補地を示しています。` : '',
    distanceMinutes !== undefined ? `指定時刻から最短${distanceMinutes}分の記録です。` : '',
  ].filter(Boolean);
  return {
    eventId: representative.id,
    locationName: representative.locationName ?? `${representative.latitude}, ${representative.longitude}`,
    latitude: representative.latitude,
    longitude: representative.longitude,
    confidence: bestConfidence,
    reasons: [...new Set(reasons)],
    supportingEventIds: events.map((event) => event.id),
    sourcePriorities,
    distanceMinutes,
  };
}

function eventToCandidate(event: TimelineEvent, queryAt?: string, extraReasons: string[] = []): LocationCandidate {
  return mergeEventsToCandidate([event], queryAt, undefined, extraReasons);
}

function collectConflicts(beforeEvent?: TimelineEvent, afterEvent?: TimelineEvent): TimelineEventSource[] {
  if (!beforeEvent || !afterEvent || samePlace(beforeEvent, afterEvent)) return [];
  return [toEventSource(beforeEvent), toEventSource(afterEvent)];
}

function samePlace(a: TimelineEvent, b: TimelineEvent): boolean {
  if (a.locationName && b.locationName && normalizeLocationName(a.locationName) === normalizeLocationName(b.locationName)) return true;
  if (hasCoordinates(a) && hasCoordinates(b)) return distanceMeters(a.latitude!, a.longitude!, b.latitude!, b.longitude!) <= SAME_PLACE_DISTANCE_METERS;
  return false;
}

function hasLocationSignal(event: TimelineEvent): boolean {
  return Boolean(event.locationName) || hasCoordinates(event);
}

function hasCoordinates(event: TimelineEvent): boolean {
  return typeof event.latitude === 'number' && typeof event.longitude === 'number';
}

function locationKey(event: TimelineEvent): string {
  if (event.locationName) return `name:${normalizeLocationName(event.locationName)}`;
  return `coord:${event.latitude?.toFixed(3)}:${event.longitude?.toFixed(3)}`;
}

function normalizeLocationName(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function compareCandidates(a: LocationCandidate, b: LocationCandidate): number {
  return confidenceRank(b.confidence) - confidenceRank(a.confidence)
    || Math.min(...a.sourcePriorities) - Math.min(...b.sourcePriorities)
    || (a.distanceMinutes ?? Number.MAX_SAFE_INTEGER) - (b.distanceMinutes ?? Number.MAX_SAFE_INTEGER)
    || b.supportingEventIds.length - a.supportingEventIds.length;
}

function compareTimelineEvents(a: TimelineEvent, b: TimelineEvent): number {
  if (!a.startAt && !b.startAt) return a.sourcePriority - b.sourcePriority;
  if (!a.startAt) return 1;
  if (!b.startAt) return -1;
  return a.startAt.localeCompare(b.startAt) || a.sourcePriority - b.sourcePriority;
}

function toEventSource(event: Pick<TimelineEvent, 'sourceType' | 'sourceId' | 'startAt' | 'confidence' | 'title'>): TimelineEventSource {
  return {
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    timestamp: event.startAt,
    reliability: event.confidence,
    summary: event.title,
  };
}

function adjustConfidenceForTime(event: TimelineEvent, queryAt?: string): TimelineConfidence {
  if (!queryAt) return event.confidence;
  if (!event.startAt) return event.confidence === 'exact' ? 'medium' : event.confidence;
  if (withinHours(event.startAt, queryAt, QUERY_WINDOW_HOURS)) return event.confidence;
  return confidenceRank(event.confidence) > confidenceRank('medium') ? 'medium' : event.confidence;
}

function withinHours(value: string, center: string, hours: number): boolean {
  return Math.abs(new Date(value).getTime() - new Date(center).getTime()) <= hours * 60 * 60 * 1000;
}

function withinMinutes(value: string, center: string, minutes: number): boolean {
  return Math.abs(new Date(value).getTime() - new Date(center).getTime()) <= minutes * 60 * 1000;
}

function maxConfidence(a: TimelineConfidence, b: TimelineConfidence): TimelineConfidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

function downgradeConfidence(confidence: TimelineConfidence): TimelineConfidence {
  if (confidence === 'exact') return 'high';
  if (confidence === 'high') return 'medium';
  return confidence;
}

function confidenceRank(confidence: TimelineConfidence): number {
  return { unknown: 0, low: 1, medium: 2, high: 3, exact: 4 }[confidence];
}

function minDefined(...values: Array<number | undefined>): number | undefined {
  const numbers = values.filter((value): value is number => typeof value === 'number');
  return numbers.length > 0 ? Math.min(...numbers) : undefined;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}
