import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type { PlaceVisit, TripTransportLeg, TripTransportMode } from '../../../domain/models/trip.ts';
import { BottomSheet, Button, InlineError, useToast } from '../../../shared/ui';
import { resolveCurrentTripActivity } from '../currentTripActivity.ts';
import { arriveExistingPlaceVisitNow, startTransportFromPlace } from '../currentTripActivityService.ts';
import { formatPlaceVisitTimeRange } from '../placeVisitDateTime.ts';
import {
  arriveTransportAndExistingPlaceNow,
  createExplicitPlaceVisitAndArriveTransport,
} from '../tripArrivalLinkService.ts';
import { arriveTripTransportLegNow, createQuickPlaceVisit, departPlaceVisitNow } from '../tripService.ts';
import { formatTransportLegTimeRange, formatTransportLegTitle } from '../transportLegDateTime.ts';
import type { TripLiveRecordingAvailability } from '../tripLiveRecording.ts';
import { TRANSPORT_MODE_LABELS, TRANSPORT_MODE_OPTIONS } from '../tripUi.ts';

interface CurrentTripActivityProps {
  tripId: string;
  places: PlaceVisit[];
  transportLegs: TripTransportLeg[];
  liveRecordingAvailability: TripLiveRecordingAvailability;
  onChanged: () => void;
  onEditPlace: (place: PlaceVisit) => void;
  onEditTransport: (leg: TripTransportLeg) => void;
}

type EditorMode = 'idle-arrival' | 'departure' | 'transport-arrival';
type ArrivalDestination = 'transport-only' | 'existing' | 'new';
type DepartureStep = 'choose' | 'transport';

export function CurrentTripActivity({
  tripId,
  places,
  transportLegs,
  liveRecordingAvailability,
  onChanged,
  onEditPlace,
  onEditTransport,
}: CurrentTripActivityProps) {
  const { showToast } = useToast();
  const formId = useId();
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const departureChoiceRef = useRef<HTMLButtonElement>(null);
  const stayEndInFlightRef = useRef(false);
  const activity = useMemo(() => resolveCurrentTripActivity(places, transportLegs), [places, transportLegs]);
  const [editorMode, setEditorMode] = useState<EditorMode>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [moment, setMoment] = useState(() => new Date());
  const [newPlaceName, setNewPlaceName] = useState('');
  const [existingPlaceId, setExistingPlaceId] = useState('');
  const [transportMode, setTransportMode] = useState<TripTransportMode>('train');
  const [destinationPlaceId, setDestinationPlaceId] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [arrivalDestination, setArrivalDestination] = useState<ArrivalDestination>('transport-only');
  const [departureStep, setDepartureStep] = useState<DepartureStep>('choose');

  if (!liveRecordingAvailability.allowed) {
    const copy = getUnavailableCopy(liveRecordingAvailability.state);
    return (
      <section className="quick-visit current-activity" aria-labelledby="current-activity-title">
        <div className="quick-visit__heading">
          <div><span>Now</span><h2 id="current-activity-title">いま</h2></div>
        </div>
        <div className="current-activity__state current-activity__state--unavailable">
          <span className="quick-visit__status">{copy.status}</span>
          <strong>{copy.message}</strong>
          <small>訪問場所や移動の内容は、下の編集メニューから確認・修正できます。</small>
        </div>
      </section>
    );
  }

  const idlePlaceOptions = places.filter((place) => !place.deletedAt && !place.arrivalAt && !place.departureAt);
  const destinationOptions = places.filter((place) => !place.deletedAt && place.id !== (activity.kind === 'staying' ? activity.place.id : ''));
  const arrivalPlaceOptions = places.filter((place) => !place.deletedAt && !place.arrivalAt && !place.departureAt);

  function openEditor(mode: EditorMode) {
    const now = new Date();
    setMoment(now);
    setError('');
    setNewPlaceName('');
    setExistingPlaceId('');
    setTransportMode('train');
    setDestinationPlaceId('');
    setDestinationName('');
    setArrivalDestination('transport-only');
    setDepartureStep('choose');
    if (mode === 'transport-arrival' && activity.kind === 'moving') {
      const linked = activity.leg.toPlaceVisitId
        ? arrivalPlaceOptions.find((place) => place.id === activity.leg.toPlaceVisitId)
        : undefined;
      if (linked) {
        setArrivalDestination('existing');
        setDestinationPlaceId(linked.id);
      } else if (activity.leg.toName?.trim()) {
        setArrivalDestination('new');
        setDestinationName(activity.leg.toName);
      }
    }
    setEditorMode(mode);
  }

  function closeEditor() {
    if (saving) return;
    setEditorMode(undefined);
    setError('');
  }

  async function saveIdleArrival(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || activity.kind !== 'idle') return;
    setSaving(true);
    setError('');
    try {
      if (existingPlaceId) await arriveExistingPlaceVisitNow(existingPlaceId, moment);
      else await createQuickPlaceVisit(tripId, newPlaceName, moment);
      finishSave('到着を記録しました。');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '到着を記録できませんでした。'));
    } finally {
      setSaving(false);
    }
  }

  async function saveDeparture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || activity.kind !== 'staying') return;
    setSaving(true);
    setError('');
    try {
      await startTransportFromPlace(activity.place.id, {
        transportMode,
        toPlaceVisitId: destinationPlaceId || undefined,
        toName: destinationPlaceId ? undefined : destinationName,
      }, moment);
      finishSave('出発と移動開始を記録しました。');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '出発を記録できませんでした。'));
    } finally {
      setSaving(false);
    }
  }

  async function endStayOnly() {
    if (stayEndInFlightRef.current || saving || activity.kind !== 'staying') return;
    stayEndInFlightRef.current = true;
    setSaving(true);
    setError('');
    try {
      await departPlaceVisitNow(activity.place.id, moment);
      finishSave('滞在の終了を記録しました。');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '滞在の終了を記録できませんでした。'));
    } finally {
      stayEndInFlightRef.current = false;
      setSaving(false);
    }
  }

  function showTransportForm() {
    setDepartureStep('transport');
    window.requestAnimationFrame(() => firstInputRef.current?.focus());
  }

  async function saveTransportArrival() {
    if (saving || activity.kind !== 'moving') return;
    setSaving(true);
    setError('');
    try {
      if (arrivalDestination === 'existing') {
        if (!destinationPlaceId) throw new Error('到着先の訪問場所を選んでください。');
        await arriveTransportAndExistingPlaceNow(activity.leg.id, destinationPlaceId, moment);
        finishSave('移動と訪問の到着を記録しました。');
      } else if (arrivalDestination === 'new') {
        if (!destinationName.trim()) throw new Error('場所名を入力してください。');
        await createExplicitPlaceVisitAndArriveTransport(tripId, activity.leg.id, destinationName, moment);
        finishSave('移動と新しい訪問場所の到着を記録しました。');
      } else {
        await arriveTripTransportLegNow(activity.leg.id, undefined, moment);
        finishSave('移動の到着を記録しました。');
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, '到着を記録できませんでした。'));
    } finally {
      setSaving(false);
    }
  }

  function finishSave(title: string) {
    setEditorMode(undefined);
    onChanged();
    showToast({ title, variant: 'success' });
  }

  return (
    <section className="quick-visit current-activity" aria-labelledby="current-activity-title">
      <div className="quick-visit__heading">
        <div><span>Now</span><h2 id="current-activity-title">いま</h2></div>
        {activity.kind === 'idle' && <Button variant="primary" onClick={() => openEditor('idle-arrival')}>ここに到着</Button>}
        {activity.kind === 'staying' && <Button variant="primary" onClick={() => openEditor('departure')}>ここを出発</Button>}
        {activity.kind === 'moving' && <Button variant="primary" onClick={() => openEditor('transport-arrival')}>到着</Button>}
      </div>

      {error && !editorMode && <InlineError message={error} />}

      {activity.kind === 'idle' && (
        <div className="current-activity__state current-activity__state--idle">
          <span className="quick-visit__status">記録待ち</span>
          <strong>次の場所へ着いたら、ここから記録できます。</strong>
        </div>
      )}
      {activity.kind === 'staying' && (
        <div className="quick-visit__place">
          <div className="quick-visit__place-copy">
            <span className="quick-visit__status quick-visit__status--active">滞在中</span>
            <strong>{activity.place.name}</strong>
            <time dateTime={activity.place.arrivalAt}>{formatPlaceVisitTimeRange(activity.place)}</time>
          </div>
          <div className="quick-visit__actions"><Button onClick={() => onEditPlace(activity.place)}>詳細を編集</Button></div>
        </div>
      )}
      {activity.kind === 'moving' && (
        <div className="quick-visit__place">
          <div className="quick-visit__place-copy">
            <span className="quick-visit__status quick-visit__status--active">移動中</span>
            <strong>{formatTransportLegTitle(activity.leg)}</strong>
            <time dateTime={activity.leg.departureAt}>{formatTransportLegTimeRange(activity.leg)} ・ {TRANSPORT_MODE_LABELS[activity.leg.transportMode]}</time>
          </div>
          <div className="quick-visit__actions"><Button onClick={() => onEditTransport(activity.leg)}>詳細を編集</Button></div>
        </div>
      )}
      {activity.kind === 'conflict' && (
        <div className="current-activity__conflict" role="alert">
          <InlineError message="滞在中と移動中の記録が重複しています。自動更新せず、詳細から時刻を確認してください。" />
          <div className="quick-visit__actions">
            {activity.places.map((place) => <Button key={place.id} onClick={() => onEditPlace(place)}>{place.name}を編集</Button>)}
            {activity.legs.map((leg) => <Button key={leg.id} onClick={() => onEditTransport(leg)}>移動を編集</Button>)}
          </div>
        </div>
      )}

      <BottomSheet
        open={editorMode === 'idle-arrival'}
        onClose={closeEditor}
        title="ここに到着"
        description="登録済みの場所を選ぶか、新しい場所名を入力します。"
        initialFocusRef={firstInputRef}
        dismissible={!saving}
        actions={<><Button onClick={closeEditor} disabled={saving}>キャンセル</Button><Button variant="primary" type="submit" form={formId} loading={saving}>到着を記録</Button></>}
      >
        <form id={formId} className="quick-visit__form" onSubmit={saveIdleArrival}>
          {error && <InlineError message={error} />}
          <label className="field"><span>登録済みの訪問場所（任意）</span><select ref={firstInputRef as React.RefObject<HTMLSelectElement>} value={existingPlaceId} onChange={(event) => { setExistingPlaceId(event.target.value); if (event.target.value) setNewPlaceName(''); }}><option value="">新しい場所を記録</option>{idlePlaceOptions.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
          {!existingPlaceId && <label className="field"><span>場所名</span><input value={newPlaceName} onChange={(event) => setNewPlaceName(event.target.value)} maxLength={120} required placeholder="例: 金沢城公園" /></label>}
          <Moment value={moment} label="到着時刻" />
        </form>
      </BottomSheet>

      <BottomSheet
        open={editorMode === 'departure'}
        onClose={closeEditor}
        title="ここを出発"
        description={departureStep === 'choose' ? 'この場所を出たあとの記録方法を選びます。' : '滞在を終了し、同じ時刻で次の移動を始めます。'}
        initialFocusRef={departureStep === 'choose' ? departureChoiceRef : firstInputRef}
        dismissible={!saving}
        actions={departureStep === 'transport'
          ? <><Button onClick={() => setDepartureStep('choose')} disabled={saving}>戻る</Button><Button variant="primary" type="submit" form={formId} loading={saving}>移動を開始</Button></>
          : <Button onClick={closeEditor} disabled={saving}>キャンセル</Button>}
      >
        {departureStep === 'choose' ? (
          <div className="current-activity__departure-choices" aria-busy={saving || undefined}>
            {error && <InlineError message={error} />}
            <Button ref={departureChoiceRef} variant="primary" className="current-activity__departure-choice" onClick={showTransportForm} disabled={saving} fullWidth>
              <strong>移動を開始</strong><small>次の場所への移動を記録します</small>
            </Button>
            <Button className="current-activity__departure-choice" onClick={endStayOnly} loading={saving} fullWidth>
              <strong>滞在だけ終了</strong><small>この場所を出た時刻だけ記録します</small>
            </Button>
            <Moment value={moment} label="出発時刻" />
          </div>
        ) : (
          <form id={formId} className="quick-visit__form" onSubmit={saveDeparture}>
            {error && <InlineError message={error} />}
            <label className="field"><span>移動手段</span><select ref={firstInputRef as React.RefObject<HTMLSelectElement>} value={transportMode} onChange={(event) => setTransportMode(event.target.value as TripTransportMode)}>{TRANSPORT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="field"><span>到着先（任意）</span><select value={destinationPlaceId} onChange={(event) => { setDestinationPlaceId(event.target.value); if (event.target.value) setDestinationName(''); }}><option value="">あとで決める</option>{destinationOptions.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
            {!destinationPlaceId && <label className="field"><span>到着地名（任意）</span><input value={destinationName} onChange={(event) => setDestinationName(event.target.value)} maxLength={120} placeholder="未定のままでも保存できます" /></label>}
            <Moment value={moment} label="出発時刻" />
          </form>
        )}
      </BottomSheet>

      <BottomSheet
        open={editorMode === 'transport-arrival'}
        onClose={closeEditor}
        title="移動の到着"
        description="移動だけを終えるか、訪問場所への到着も同じ時刻で記録します。"
        dismissible={!saving}
        actions={<><Button onClick={closeEditor} disabled={saving}>キャンセル</Button><Button variant="primary" onClick={saveTransportArrival} loading={saving}>到着を記録</Button></>}
      >
        <div className="quick-visit__form">
          {error && <InlineError message={error} />}
          <fieldset className="current-activity__choices">
            <legend>記録する内容</legend>
            <label><input type="radio" name="arrival-destination" checked={arrivalDestination === 'transport-only'} onChange={() => setArrivalDestination('transport-only')} /> <span><strong>移動だけ終了</strong><small>訪問場所は作成・変更しません</small></span></label>
            <label><input type="radio" name="arrival-destination" checked={arrivalDestination === 'existing'} onChange={() => setArrivalDestination('existing')} /> <span><strong>登録済みの場所へ到着</strong><small>選んだ訪問場所にも同じ時刻を記録します</small></span></label>
            <label><input type="radio" name="arrival-destination" checked={arrivalDestination === 'new'} onChange={() => setArrivalDestination('new')} /> <span><strong>新しい訪問場所を追加</strong><small>確認した場合だけ新規作成します</small></span></label>
          </fieldset>
          {arrivalDestination === 'existing' && <label className="field"><span>訪問場所</span><select value={destinationPlaceId} onChange={(event) => setDestinationPlaceId(event.target.value)} required><option value="">選択してください</option>{arrivalPlaceOptions.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>}
          {arrivalDestination === 'new' && <label className="field"><span>新しい場所名</span><input value={destinationName} onChange={(event) => setDestinationName(event.target.value)} maxLength={120} required placeholder="例: 京都駅" /></label>}
          <Moment value={moment} label="到着時刻" />
        </div>
      </BottomSheet>
    </section>
  );
}

function getUnavailableCopy(state: TripLiveRecordingAvailability['state']): { status: string; message: string } {
  if (state === 'completed') return { status: '完了', message: 'この旅行の日程は終了しています。' };
  if (state === 'upcoming') return { status: '予定', message: 'この旅行はまだ始まっていません。' };
  return { status: '日程確認', message: '旅行日程を確認してください。' };
}

function Moment({ value, label }: { value: Date; label: string }) {
  return <div className="quick-visit__arrival"><span>{label}</span><time dateTime={value.toISOString()}>{new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value)}</time></div>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
