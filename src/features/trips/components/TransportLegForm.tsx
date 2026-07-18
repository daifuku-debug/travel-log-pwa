import { useState, type FormEvent } from 'react';
import type { TripTransportLeg, TripTransportMode } from '../../../domain/models/trip';
import { type TripTransportLegInput, validateTripTransportLegInput } from '../tripService';

const TRANSPORT_MODE_OPTIONS: Array<{ value: TripTransportMode; label: string }> = [
  { value: 'train', label: '電車' },
  { value: 'shinkansen', label: '新幹線' },
  { value: 'bus', label: 'バス' },
  { value: 'car', label: '車' },
  { value: 'flight', label: '飛行機' },
  { value: 'ship', label: '船' },
  { value: 'taxi', label: 'タクシー' },
  { value: 'bike', label: '自転車' },
  { value: 'walk', label: '徒歩' },
  { value: 'other', label: 'その他' },
];

interface TransportLegFormProps {
  leg?: TripTransportLeg;
  defaultDate: string;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: TripTransportLegInput) => Promise<void>;
}

export function TransportLegForm({
  leg,
  defaultDate,
  submitLabel,
  onCancel,
  onSubmit,
}: TransportLegFormProps) {
  const [input, setInput] = useState<TripTransportLegInput>(() => ({
    date: leg?.date ?? defaultDate,
    fromName: leg?.fromName ?? '',
    toName: leg?.toName ?? '',
    transportMode: leg?.transportMode ?? 'train',
    departureTime: leg?.departureTime ?? '',
    arrivalTime: leg?.arrivalTime ?? '',
    durationMinutes: String(leg?.durationMinutes ?? ''),
    distanceKm: String(leg?.distanceKm ?? ''),
    oneWayCost: String(leg?.oneWayCost ?? ''),
    partyCount: String(leg?.partyCount ?? 1),
    totalCost: String(leg?.totalCost ?? ''),
    memo: leg?.memo ?? '',
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateTripTransportLegInput(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      await onSubmit(input);
      if (!leg) {
        setInput({
          date: defaultDate,
          fromName: '',
          toName: '',
          transportMode: 'train',
          departureTime: '',
          arrivalTime: '',
          durationMinutes: '',
          distanceKm: '',
          oneWayCost: '',
          partyCount: '1',
          totalCost: '',
          memo: '',
        });
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '保存に失敗しました。']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form form--compact" onSubmit={handleSubmit}>
      {errors.length > 0 && (
        <div className="form-errors">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </div>
      )}

      <div className="form-grid">
        <label className="field">
          <span>移動日</span>
          <input type="date" value={input.date} onChange={(event) => setInput({ ...input, date: event.target.value })} />
        </label>
        <label className="field">
          <span>交通手段</span>
          <select value={input.transportMode} onChange={(event) => setInput({ ...input, transportMode: event.target.value as TripTransportMode })}>
            {TRANSPORT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>出発地</span>
          <input value={input.fromName} onChange={(event) => setInput({ ...input, fromName: event.target.value })} placeholder="例: 東京駅" />
        </label>
        <label className="field">
          <span>到着地</span>
          <input value={input.toName} onChange={(event) => setInput({ ...input, toName: event.target.value })} placeholder="例: 京都駅" />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>出発時刻</span>
          <input type="time" value={input.departureTime} onChange={(event) => setInput({ ...input, departureTime: event.target.value })} />
        </label>
        <label className="field">
          <span>到着時刻</span>
          <input type="time" value={input.arrivalTime} onChange={(event) => setInput({ ...input, arrivalTime: event.target.value })} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>所要時間 分</span>
          <input type="number" min="0" value={input.durationMinutes} onChange={(event) => setInput({ ...input, durationMinutes: event.target.value })} />
        </label>
        <label className="field">
          <span>距離 km</span>
          <input type="number" min="0" step="0.1" value={input.distanceKm} onChange={(event) => setInput({ ...input, distanceKm: event.target.value })} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>片道交通費</span>
          <input type="number" min="0" step="10" value={input.oneWayCost} onChange={(event) => setInput({ ...input, oneWayCost: event.target.value })} />
        </label>
        <label className="field">
          <span>人数</span>
          <input type="number" min="1" step="1" value={input.partyCount} onChange={(event) => setInput({ ...input, partyCount: event.target.value })} />
        </label>
      </div>

      <label className="field">
        <span>交通費合計</span>
        <input type="number" min="0" step="10" value={input.totalCost} onChange={(event) => setInput({ ...input, totalCost: event.target.value })} placeholder="空なら片道交通費 × 人数" />
      </label>

      <label className="field">
        <span>メモ</span>
        <textarea value={input.memo} onChange={(event) => setInput({ ...input, memo: event.target.value })} rows={3} />
      </label>

      <div className="form-actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? '保存中...' : submitLabel}
        </button>
        {onCancel && <button className="button" type="button" onClick={onCancel}>キャンセル</button>}
      </div>
    </form>
  );
}
