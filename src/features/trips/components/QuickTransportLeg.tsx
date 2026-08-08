import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { PlaceVisit, TripTransportLeg, TripTransportMode } from '../../../domain/models/trip';
import { BottomSheet, Button, InlineError, useToast } from '../../../shared/ui';
import {
  findInProgressTransportLegs,
  formatTransportLegTimeRange,
  formatTransportLegTitle,
} from '../transportLegDateTime.ts';
import { arriveTripTransportLegNow, createQuickTripTransportLeg } from '../tripService';
import { TRANSPORT_MODE_LABELS, TRANSPORT_MODE_OPTIONS } from '../tripUi.ts';

export interface QuickTransportStartSeed {
  requestId: number;
  place: PlaceVisit;
}

interface QuickTransportLegProps {
  tripId: string;
  places: PlaceVisit[];
  transportLegs: TripTransportLeg[];
  startSeed?: QuickTransportStartSeed;
  onStartSeedConsumed: () => void;
  onChanged: () => void;
  onEdit: (leg: TripTransportLeg) => void;
}

export function QuickTransportLeg({
  tripId,
  places,
  transportLegs,
  startSeed,
  onStartSeedConsumed,
  onChanged,
  onEdit,
}: QuickTransportLegProps) {
  const { showToast } = useToast();
  const formId = useId();
  const fromInputRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fromName, setFromName] = useState('');
  const [toName, setToName] = useState('');
  const [transportMode, setTransportMode] = useState<TripTransportMode>('train');
  const [departureAt, setDepartureAt] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [arrivingId, setArrivingId] = useState<string>();
  const [error, setError] = useState('');
  const activeLegs = findInProgressTransportLegs(transportLegs);
  const recentLeg = transportLegs
    .slice()
    .sort((a, b) => String(b.departureAt || b.date).localeCompare(String(a.departureAt || a.date)))[0];

  useEffect(() => {
    if (!startSeed) return;
    if (activeLegs.length === 0) openQuickEntry(startSeed.place);
    onStartSeedConsumed();
  }, [startSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  function openQuickEntry(seedPlace?: PlaceVisit) {
    if (activeLegs.length > 0) return;
    const recentDeparture = places
      .filter((place) => place.departureAt)
      .slice()
      .sort((a, b) => String(b.departureAt).localeCompare(String(a.departureAt)))[0];
    const departurePlace = seedPlace ?? recentDeparture;
    setFromName(departurePlace?.name ?? '');
    setToName('');
    setTransportMode('train');
    setDepartureAt(departurePlace?.departureAt ? new Date(departurePlace.departureAt) : new Date());
    setError('');
    setSheetOpen(true);
  }

  function closeQuickEntry() {
    if (saving) return;
    setSheetOpen(false);
    setError('');
  }

  async function saveStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await createQuickTripTransportLeg(tripId, {
        fromName,
        toName,
        transportMode,
        departureAt: departureAt.toISOString(),
      });
      setSheetOpen(false);
      onChanged();
      showToast({ title: '移動を開始しました。', variant: 'success' });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '移動を開始できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  async function saveArrival(leg: TripTransportLeg) {
    if (arrivingId) return;
    setArrivingId(leg.id);
    setError('');
    try {
      await arriveTripTransportLegNow(leg.id);
      onChanged();
      showToast({ title: '到着を記録しました。', variant: 'success' });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '到着を記録できませんでした。');
    } finally {
      setArrivingId(undefined);
    }
  }

  const displayedLegs = activeLegs.length > 0 ? activeLegs : recentLeg ? [recentLeg] : [];

  return (
    <section className="quick-visit quick-transport" aria-labelledby="quick-transport-title">
      <div className="quick-visit__heading">
        <div>
          <span>Move</span>
          <h2 id="quick-transport-title">いまの移動</h2>
        </div>
        <Button variant="primary" onClick={() => openQuickEntry()} disabled={activeLegs.length > 0}>
          移動を開始
        </Button>
      </div>

      {error && !sheetOpen && <InlineError message={error} />}

      {displayedLegs.length > 0 ? (
        <div className="quick-visit__list">
          {displayedLegs.map((leg) => {
            const inProgress = activeLegs.some((active) => active.id === leg.id);
            return (
              <div className="quick-visit__place" key={leg.id}>
                <div className="quick-visit__place-copy">
                  <span className={`quick-visit__status${inProgress ? ' quick-visit__status--active' : ''}`}>
                    {inProgress ? '移動中' : '移動終了'}
                  </span>
                  <strong>{formatTransportLegTitle(leg)}</strong>
                  <time dateTime={leg.departureAt}>{formatTransportLegTimeRange(leg)} ・ {TRANSPORT_MODE_LABELS[leg.transportMode]}</time>
                </div>
                <div className="quick-visit__actions">
                  {inProgress && (
                    <Button
                      variant="primary"
                      loading={arrivingId === leg.id}
                      disabled={Boolean(arrivingId)}
                      onClick={() => saveArrival(leg)}
                    >
                      今到着
                    </Button>
                  )}
                  <Button onClick={() => onEdit(leg)} disabled={Boolean(arrivingId)}>
                    詳細を編集
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="quick-visit__empty">移動手段と出発時刻だけで、次の区間をすぐ記録できます。</p>
      )}

      {activeLegs.length > 0 && (
        <p className="quick-visit__hint">新しい移動を始める前に、現在の区間へ到着時刻を記録してください。</p>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={closeQuickEntry}
        title="移動を開始"
        description="出発地と移動手段を記録します。到着地は後から追加できます。"
        initialFocusRef={fromInputRef}
        dismissible={!saving}
        actions={(
          <>
            <Button onClick={closeQuickEntry} disabled={saving}>キャンセル</Button>
            <Button variant="primary" type="submit" form={formId} loading={saving}>出発を記録</Button>
          </>
        )}
      >
        <form id={formId} className="quick-visit__form" onSubmit={saveStart}>
          {error && <InlineError message={error} />}
          <label className="field">
            <span>出発地</span>
            <input
              ref={fromInputRef}
              value={fromName}
              onChange={(event) => setFromName(event.target.value)}
              list={`${formId}-places`}
              maxLength={120}
              placeholder="例: 金沢駅"
              required
            />
          </label>
          <label className="field">
            <span>到着地（任意）</span>
            <input
              value={toName}
              onChange={(event) => setToName(event.target.value)}
              list={`${formId}-places`}
              maxLength={120}
              placeholder="あとから追加できます"
            />
          </label>
          <datalist id={`${formId}-places`}>
            {[...new Set(places.map((place) => place.name))].map((name) => <option key={name} value={name} />)}
          </datalist>
          <label className="field">
            <span>移動手段</span>
            <select value={transportMode} onChange={(event) => setTransportMode(event.target.value as TripTransportMode)}>
              {TRANSPORT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="quick-visit__arrival">
            <span>出発時刻</span>
            <time dateTime={departureAt.toISOString()}>{formatCurrentMoment(departureAt)}</time>
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
