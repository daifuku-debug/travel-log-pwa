import { useState, type FormEvent } from 'react';
import type { Trip } from '../../../domain/models/trip';
import { todayDateInputValue } from '../../../shared/date/dateUtils';
import { type TripInput, validateTripInput } from '../tripService';

interface TripFormProps {
  trip?: Trip;
  submitLabel: string;
  onSubmit: (input: TripInput) => Promise<void>;
}

export function TripForm({ trip, submitLabel, onSubmit }: TripFormProps) {
  const [input, setInput] = useState<TripInput>(() => ({
    title: trip?.title ?? '',
    startDate: trip?.startDate ?? todayDateInputValue(),
    endDate: trip?.endDate ?? todayDateInputValue(),
    tripType: trip?.tripType ?? 'dayTrip',
    companionsText: trip?.companions.join(', ') ?? '',
    purpose: trip?.purpose ?? '',
    memo: trip?.memo ?? '',
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateTripInput(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      await onSubmit(input);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '保存に失敗しました。']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {errors.length > 0 && (
        <div className="form-errors">
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}

      <label className="field">
        <span>タイトル</span>
        <input
          value={input.title}
          onChange={(event) => setInput({ ...input, title: event.target.value })}
          placeholder="例: 金沢 週末旅行"
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>開始日</span>
          <input
            type="date"
            value={input.startDate}
            onChange={(event) => setInput({ ...input, startDate: event.target.value })}
          />
        </label>

        <label className="field">
          <span>終了日</span>
          <input
            type="date"
            value={input.endDate}
            onChange={(event) => setInput({ ...input, endDate: event.target.value })}
          />
        </label>
      </div>

      <label className="field">
        <span>日帰り／宿泊</span>
        <select
          value={input.tripType}
          onChange={(event) => setInput({ ...input, tripType: event.target.value as TripInput['tripType'] })}
        >
          <option value="dayTrip">日帰り</option>
          <option value="overnight">宿泊</option>
        </select>
      </label>

      <label className="field">
        <span>同行者</span>
        <input
          value={input.companionsText}
          onChange={(event) => setInput({ ...input, companionsText: event.target.value })}
          placeholder="例: 家族, 友人"
        />
      </label>

      <label className="field">
        <span>目的</span>
        <input
          value={input.purpose}
          onChange={(event) => setInput({ ...input, purpose: event.target.value })}
          placeholder="例: 城めぐり"
        />
      </label>

      <label className="field">
        <span>メモ</span>
        <textarea
          value={input.memo}
          onChange={(event) => setInput({ ...input, memo: event.target.value })}
          rows={4}
        />
      </label>

      <div className="form-actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? '保存中...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
