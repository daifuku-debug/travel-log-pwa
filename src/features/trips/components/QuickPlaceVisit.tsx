import { useId, useRef, useState, type FormEvent } from 'react';
import type { PlaceVisit, TripTransportLeg } from '../../../domain/models/trip';
import { BottomSheet, Button, InlineError, useToast } from '../../../shared/ui';
import {
  findInProgressPlaceVisits,
  formatPlaceVisitTimeRange,
  isPlaceVisitInProgress,
} from '../placeVisitDateTime.ts';
import { isReverseTransportArrivalCandidate } from '../tripArrivalLink.ts';
import { createQuickPlaceVisitAndArriveTransport } from '../tripArrivalLinkService.ts';
import { findInProgressTransportLegs } from '../transportLegDateTime.ts';
import { createQuickPlaceVisit, departPlaceVisitNow } from '../tripService';

interface QuickPlaceVisitProps {
  tripId: string;
  places: PlaceVisit[];
  transportLegs: TripTransportLeg[];
  onChanged: () => void;
  onEdit: (place: PlaceVisit) => void;
  onStartTransport: (place: PlaceVisit) => void;
  transportInProgress: boolean;
}

export function QuickPlaceVisit({ tripId, places, transportLegs, onChanged, onEdit, onStartTransport, transportInProgress }: QuickPlaceVisitProps) {
  const { showToast } = useToast();
  const formId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [arrivalAt, setArrivalAt] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [linkCandidate, setLinkCandidate] = useState<TripTransportLeg>();
  const [departingId, setDepartingId] = useState<string>();
  const [error, setError] = useState('');
  const activePlaces = findInProgressPlaceVisits(places);
  const recentTimedPlace = places
    .filter((place) => place.arrivalAt)
    .slice()
    .sort((a, b) => String(b.arrivalAt).localeCompare(String(a.arrivalAt)))[0];

  function openQuickEntry() {
    if (activePlaces.length > 0) return;
    setName('');
    setLinkCandidate(undefined);
    setArrivalAt(new Date());
    setError('');
    setSheetOpen(true);
  }

  function closeQuickEntry() {
    if (saving) return;
    setSheetOpen(false);
    setName('');
    setLinkCandidate(undefined);
    setError('');
  }

  async function saveArrival(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const activeTransport = findInProgressTransportLegs(transportLegs)[0];
    if (activeTransport && isReverseTransportArrivalCandidate(activeTransport, name)) {
      setLinkCandidate(activeTransport);
      return;
    }
    await persistArrival(false);
  }

  async function persistArrival(includeTransport: boolean) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      if (includeTransport && linkCandidate) {
        await createQuickPlaceVisitAndArriveTransport(tripId, linkCandidate.id, name, arrivalAt);
      } else {
        await createQuickPlaceVisit(tripId, name, arrivalAt);
      }
      setSheetOpen(false);
      setName('');
      setLinkCandidate(undefined);
      onChanged();
      showToast({ title: includeTransport ? '移動と訪問の到着を記録しました。' : '到着を記録しました。', variant: 'success' });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '到着を記録できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  async function saveDeparture(place: PlaceVisit) {
    if (departingId) return;
    setDepartingId(place.id);
    setError('');
    try {
      await departPlaceVisitNow(place.id);
      onChanged();
      showToast({ title: '出発を記録しました。', variant: 'success' });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '出発を記録できませんでした。');
    } finally {
      setDepartingId(undefined);
    }
  }

  const displayedPlaces = activePlaces.length > 0
    ? activePlaces
    : recentTimedPlace
      ? [recentTimedPlace]
      : [];

  return (
    <section className="quick-visit" aria-labelledby="quick-visit-title">
      <div className="quick-visit__heading">
        <div>
          <span>Now</span>
          <h2 id="quick-visit-title">いまの訪問記録</h2>
        </div>
        <Button variant="primary" onClick={openQuickEntry} disabled={activePlaces.length > 0}>
          今ここに着いた
        </Button>
      </div>

      {error && !sheetOpen && <InlineError message={error} />}

      {displayedPlaces.length > 0 ? (
        <div className="quick-visit__list">
          {displayedPlaces.map((place) => {
            const inProgress = isPlaceVisitInProgress(place);
            return (
              <div className="quick-visit__place" key={place.id}>
                <div className="quick-visit__place-copy">
                  <span className={`quick-visit__status${inProgress ? ' quick-visit__status--active' : ''}`}>
                    {inProgress ? '滞在中' : '滞在終了'}
                  </span>
                  <strong>{place.name}</strong>
                  <time dateTime={place.arrivalAt}>{formatPlaceVisitTimeRange(place)}</time>
                </div>
                <div className="quick-visit__actions">
                  {inProgress && (
                    <Button
                      variant="primary"
                      loading={departingId === place.id}
                      disabled={Boolean(departingId)}
                      onClick={() => saveDeparture(place)}
                    >
                      今出発
                    </Button>
                  )}
                  {!inProgress && place.departureAt && (
                    <Button variant="primary" onClick={() => onStartTransport(place)} disabled={Boolean(departingId) || transportInProgress}>
                      移動を記録
                    </Button>
                  )}
                  <Button onClick={() => onEdit(place)} disabled={Boolean(departingId)}>
                    詳細を編集
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="quick-visit__empty">到着した場所を、名前と現在時刻だけですぐ記録できます。</p>
      )}

      {activePlaces.length > 0 && (
        <p className="quick-visit__hint">次の場所を記録する前に、現在の滞在を終了してください。</p>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={closeQuickEntry}
        title={linkCandidate ? `${name}へ到着` : '今ここに着いた'}
        description={linkCandidate ? '直前の移動も同じ時刻で到着にしますか？' : '場所名と現在の到着時刻を記録します。'}
        initialFocusRef={nameInputRef}
        dismissible={!saving}
        actions={linkCandidate ? (
          <div className="quick-arrival-actions">
            <Button onClick={() => setLinkCandidate(undefined)} disabled={saving}>キャンセル</Button>
            <Button onClick={() => persistArrival(false)} disabled={saving}>訪問だけ記録</Button>
            <Button variant="primary" onClick={() => persistArrival(true)} loading={saving}>移動と訪問の両方に記録</Button>
          </div>
        ) : (
          <>
            <Button onClick={closeQuickEntry} disabled={saving}>キャンセル</Button>
            <Button variant="primary" type="submit" form={formId} loading={saving}>到着を記録</Button>
          </>
        )}
      >
        <form id={formId} className="quick-visit__form" onSubmit={saveArrival}>
          {error && <InlineError message={error} />}
          {!linkCandidate && <label className="field">
            <span>場所名</span>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="例: 金沢城公園"
              required
            />
          </label>}
          {linkCandidate && (
            <div className="quick-arrival-review" aria-live="polite">
              <p><strong>{linkCandidate.fromName} → {linkCandidate.toName}</strong></p>
              <p>場所名が一致する未完了の移動です。確認した場合だけ、両方へ同じ到着時刻を記録します。</p>
            </div>
          )}
          <div className="quick-visit__arrival">
            <span>到着時刻</span>
            <time dateTime={arrivalAt.toISOString()}>{formatCurrentMoment(arrivalAt)}</time>
          </div>
        </form>
      </BottomSheet>
    </section>
  );
}

function formatCurrentMoment(value: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}
