import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { PlaceVisit, TripTransportLeg, TripTransportMode } from '../../../domain/models/trip';
import { BottomSheet, Button, InlineError, useToast } from '../../../shared/ui';
import {
  isTransportDestinationUnregistered,
  resolveTransportArrivalVisitCandidate,
  type TransportArrivalVisitCandidate,
} from '../tripArrivalLink.ts';
import {
  arriveTransportAndPlaceNow,
  createPlaceVisitFromTransportArrival,
} from '../tripArrivalLinkService.ts';
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

interface ArrivalReview {
  leg: TripTransportLeg;
  arrivedAt: Date;
  candidate: TransportArrivalVisitCandidate;
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
  const [toPlaceVisitId, setToPlaceVisitId] = useState('');
  const [transportMode, setTransportMode] = useState<TripTransportMode>('train');
  const [departureAt, setDepartureAt] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [arrivingId, setArrivingId] = useState<string>();
  const [arrivalReview, setArrivalReview] = useState<ArrivalReview>();
  const [addPlaceLeg, setAddPlaceLeg] = useState<TripTransportLeg>();
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
    setToPlaceVisitId('');
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
        toPlaceVisitId: toPlaceVisitId || undefined,
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

  function openArrivalReview(leg: TripTransportLeg) {
    if (arrivingId) return;
    const arrivedAt = new Date();
    setError('');
    setArrivalReview({
      leg,
      arrivedAt,
      candidate: resolveTransportArrivalVisitCandidate(leg, places, arrivedAt.toISOString()),
    });
  }

  async function saveTransportArrival(includePlace: boolean) {
    if (!arrivalReview || arrivingId) return;
    const { leg, arrivedAt, candidate } = arrivalReview;
    setArrivingId(leg.id);
    setError('');
    try {
      if (includePlace && candidate.kind !== 'unregistered' && candidate.canRecordArrival) {
        await arriveTransportAndPlaceNow(leg.id, candidate.place.id, arrivedAt);
        showToast({ title: '移動と訪問の到着を記録しました。', variant: 'success' });
      } else {
        await arriveTripTransportLegNow(leg.id, undefined, arrivedAt);
        showToast({ title: '移動の到着を記録しました。', variant: 'success' });
      }
      setArrivalReview(undefined);
      onChanged();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '到着を記録できませんでした。');
    } finally {
      setArrivingId(undefined);
    }
  }

  async function addPlaceFromTransport() {
    if (!addPlaceLeg || arrivingId) return;
    setArrivingId(addPlaceLeg.id);
    setError('');
    try {
      await createPlaceVisitFromTransportArrival(addPlaceLeg.id);
      setAddPlaceLeg(undefined);
      onChanged();
      showToast({ title: '訪問場所として追加しました。', variant: 'success' });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '訪問場所を追加できませんでした。');
    } finally {
      setArrivingId(undefined);
    }
  }

  const displayedLegs = activeLegs.length > 0 ? activeLegs : recentLeg ? [recentLeg] : [];
  const linkedCandidate = arrivalReview && arrivalReview.candidate.kind !== 'unregistered'
    ? arrivalReview.candidate
    : undefined;
  const unregisteredDestination = arrivalReview
    ? isTransportDestinationUnregistered(arrivalReview.leg, places)
    : false;

  return (
    <section className="quick-visit quick-transport" aria-labelledby="quick-transport-title">
      <div className="quick-visit__heading">
        <div><span>Move</span><h2 id="quick-transport-title">いまの移動</h2></div>
        <Button variant="primary" onClick={() => openQuickEntry()} disabled={activeLegs.length > 0}>移動を開始</Button>
      </div>

      {error && !sheetOpen && !arrivalReview && !addPlaceLeg && <InlineError message={error} />}

      {displayedLegs.length > 0 ? (
        <div className="quick-visit__list">
          {displayedLegs.map((leg) => {
            const inProgress = activeLegs.some((active) => active.id === leg.id);
            const canAddDestination = !inProgress
              && Boolean(leg.arrivalAt)
              && isTransportDestinationUnregistered(leg, places);
            return (
              <div className="quick-visit__place" key={leg.id}>
                <div className="quick-visit__place-copy">
                  <span className={`quick-visit__status${inProgress ? ' quick-visit__status--active' : ''}`}>{inProgress ? '移動中' : '移動終了'}</span>
                  <strong>{formatTransportLegTitle(leg)}</strong>
                  <time dateTime={leg.departureAt}>{formatTransportLegTimeRange(leg)} ・ {TRANSPORT_MODE_LABELS[leg.transportMode]}</time>
                </div>
                <div className="quick-visit__actions">
                  {inProgress && <Button variant="primary" loading={arrivingId === leg.id} disabled={Boolean(arrivingId)} onClick={() => openArrivalReview(leg)}>今到着</Button>}
                  {canAddDestination && <Button variant="primary" onClick={() => setAddPlaceLeg(leg)} disabled={Boolean(arrivingId)}>訪問場所として追加</Button>}
                  <Button onClick={() => onEdit(leg)} disabled={Boolean(arrivingId)}>詳細を編集</Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="quick-visit__empty">移動手段と出発時刻だけで、次の区間をすぐ記録できます。</p>}

      {activeLegs.length > 0 && <p className="quick-visit__hint">新しい移動を始める前に、現在の区間へ到着時刻を記録してください。</p>}

      <BottomSheet open={sheetOpen} onClose={closeQuickEntry} title="移動を開始" description="出発地と移動手段を記録します。到着地は後から追加できます。" initialFocusRef={fromInputRef} dismissible={!saving} actions={<><Button onClick={closeQuickEntry} disabled={saving}>キャンセル</Button><Button variant="primary" type="submit" form={formId} loading={saving}>出発を記録</Button></>}>
        <form id={formId} className="quick-visit__form" onSubmit={saveStart}>
          {error && <InlineError message={error} />}
          <label className="field"><span>出発地</span><input ref={fromInputRef} value={fromName} onChange={(event) => setFromName(event.target.value)} maxLength={120} placeholder="例: 金沢駅" required /></label>
          <label className="field">
            <span>到着地（任意）</span>
            <small className="field__helper">登録済みの訪問場所を選ぶと、到着記録を安全に連携できます。</small>
            <select value={toPlaceVisitId} onChange={(event) => {
              const place = places.find((candidate) => candidate.id === event.target.value);
              setToPlaceVisitId(event.target.value);
              if (place) setToName(place.name);
            }}>
              <option value="">未選択</option>
              {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
            </select>
          </label>
          <label className="field"><span>到着地名（任意）</span><input value={toName} onChange={(event) => { setToName(event.target.value); setToPlaceVisitId(''); }} maxLength={120} placeholder="未登録の場所も入力できます" /></label>
          <label className="field"><span>移動手段</span><select value={transportMode} onChange={(event) => setTransportMode(event.target.value as TripTransportMode)}>{TRANSPORT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <div className="quick-visit__arrival"><span>出発時刻</span><time dateTime={departureAt.toISOString()}>{formatCurrentMoment(departureAt)}</time></div>
        </form>
      </BottomSheet>

      <BottomSheet
        open={Boolean(arrivalReview)}
        onClose={() => !arrivingId && setArrivalReview(undefined)}
        title={linkedCandidate ? `${linkedCandidate.place.name}へ到着` : '移動の到着を記録'}
        description={linkedCandidate?.canRecordArrival ? 'この場所への到着も同じ時刻で記録しますか？' : undefined}
        dismissible={!arrivingId}
        actions={linkedCandidate?.canRecordArrival ? <div className="quick-arrival-actions"><Button onClick={() => setArrivalReview(undefined)} disabled={Boolean(arrivingId)}>キャンセル</Button><Button onClick={() => saveTransportArrival(false)} disabled={Boolean(arrivingId)}>移動だけ記録</Button><Button variant="primary" onClick={() => saveTransportArrival(true)} loading={Boolean(arrivingId)}>移動と訪問の両方に記録</Button></div> : <><Button onClick={() => setArrivalReview(undefined)} disabled={Boolean(arrivingId)}>キャンセル</Button><Button variant="primary" onClick={() => saveTransportArrival(false)} loading={Boolean(arrivingId)}>移動だけ記録</Button></>}
      >
        <div className="quick-arrival-review" aria-live="polite">
          {error && <InlineError message={error} />}
          {linkedCandidate && !linkedCandidate.canRecordArrival && linkedCandidate.reason === 'already-arrived' && <p>この訪問場所にはすでに到着時刻があります。現在値は変更せず、移動だけ記録できます。</p>}
          {linkedCandidate && !linkedCandidate.canRecordArrival && linkedCandidate.reason === 'time-conflict' && <InlineError message="訪問の出発時刻より後になるため、両方へ記録できません。詳細編集で時刻を確認してください。" />}
          {linkedCandidate?.kind === 'suggested' && linkedCandidate.canRecordArrival && <p>到着地名と一致する訪問場所です。確認した場合だけ、この移動と紐付けます。</p>}
          {!linkedCandidate && <p>{unregisteredDestination && arrivalReview?.candidate.kind === 'unregistered' && arrivalReview.candidate.suggestedName ? `${arrivalReview.candidate.suggestedName}はまだ訪問場所にありません。移動到着後に追加できます。` : '安全に連携できる訪問場所がないため、移動区間の到着だけを記録します。'}</p>}
          {arrivalReview && <div className="quick-visit__arrival"><span>到着時刻</span><time dateTime={arrivalReview.arrivedAt.toISOString()}>{formatCurrentMoment(arrivalReview.arrivedAt)}</time></div>}
        </div>
      </BottomSheet>

      <BottomSheet open={Boolean(addPlaceLeg)} onClose={() => !arrivingId && setAddPlaceLeg(undefined)} title="訪問場所として追加" description={`${addPlaceLeg?.toName ?? '到着地'}を、移動の到着時刻で訪問記録へ追加します。`} dismissible={!arrivingId} actions={<><Button onClick={() => setAddPlaceLeg(undefined)} disabled={Boolean(arrivingId)}>キャンセル</Button><Button variant="primary" onClick={addPlaceFromTransport} loading={Boolean(arrivingId)}>訪問場所として追加</Button></>}>
        {error && <InlineError message={error} />}
        <p className="quick-visit__hint">移動区間と同じ到着時刻を使います。詳細は追加後に編集できます。</p>
      </BottomSheet>
    </section>
  );
}

function formatCurrentMoment(value: Date): string {
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);
}
