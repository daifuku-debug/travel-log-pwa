import { useId, useRef, useState, type FormEvent } from 'react';
import type { PlaceVisit } from '../../../domain/models/trip';
import { BottomSheet, Button, InlineError, useToast } from '../../../shared/ui';
import {
  findInProgressPlaceVisits,
  formatPlaceVisitTimeRange,
  isPlaceVisitInProgress,
} from '../placeVisitDateTime.ts';
import { createQuickPlaceVisit, departPlaceVisitNow } from '../tripService';

interface QuickPlaceVisitProps {
  tripId: string;
  places: PlaceVisit[];
  onChanged: () => void;
  onEdit: (place: PlaceVisit) => void;
  onStartTransport: (place: PlaceVisit) => void;
  transportInProgress: boolean;
}

export function QuickPlaceVisit({ tripId, places, onChanged, onEdit, onStartTransport, transportInProgress }: QuickPlaceVisitProps) {
  const { showToast } = useToast();
  const formId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [arrivalAt, setArrivalAt] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
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
    setArrivalAt(new Date());
    setError('');
    setSheetOpen(true);
  }

  function closeQuickEntry() {
    if (saving) return;
    setSheetOpen(false);
    setName('');
    setError('');
  }

  async function saveArrival(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await createQuickPlaceVisit(tripId, name, arrivalAt);
      setSheetOpen(false);
      setName('');
      onChanged();
      showToast({ title: '到着を記録しました。', variant: 'success' });
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
        title="今ここに着いた"
        description="場所名と現在の到着時刻を記録します。"
        initialFocusRef={nameInputRef}
        dismissible={!saving}
        actions={(
          <>
            <Button onClick={closeQuickEntry} disabled={saving}>キャンセル</Button>
            <Button variant="primary" type="submit" form={formId} loading={saving}>到着を記録</Button>
          </>
        )}
      >
        <form id={formId} className="quick-visit__form" onSubmit={saveArrival}>
          {error && <InlineError message={error} />}
          <label className="field">
            <span>場所名</span>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="例: 金沢城公園"
              required
            />
          </label>
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
