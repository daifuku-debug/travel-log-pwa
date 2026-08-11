export type TripDetailEditorKind = 'place' | 'transport' | 'record';

export interface TripDetailEditorTarget {
  kind: TripDetailEditorKind;
  entityId: string;
}

const EDITOR_KINDS: readonly TripDetailEditorKind[] = ['place', 'transport', 'record'];

export function parseTripDetailEditorTarget(searchParams: URLSearchParams): TripDetailEditorTarget | undefined {
  const kind = searchParams.get('edit');
  const entityId = searchParams.get('entityId')?.trim();
  if (!EDITOR_KINDS.includes(kind as TripDetailEditorKind) || !entityId) return undefined;
  return { kind: kind as TripDetailEditorKind, entityId };
}

export function setTripDetailEditorTarget(
  searchParams: URLSearchParams,
  target?: TripDetailEditorTarget,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (target) {
    next.set('edit', target.kind);
    next.set('entityId', target.entityId);
  } else {
    next.delete('edit');
    next.delete('entityId');
  }
  return next;
}
