import { useState, type FormEvent } from 'react';
import type { PlaceVisit } from '../../../domain/models/trip';
import { listCastleOptions, type CastleOption } from '../../castles/castleService';
import { isoDateTimeToDateInput } from '../../../shared/date/dateUtils';
import { useAsyncData } from '../../../shared/hooks/useAsyncData';
import { type PlaceVisitInput, validatePlaceVisitInput } from '../tripService';

interface PlaceVisitFormProps {
  place?: PlaceVisit;
  defaultVisitedDate?: string;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: PlaceVisitInput) => Promise<void>;
}

export function PlaceVisitForm({
  place,
  defaultVisitedDate = '',
  submitLabel,
  onCancel,
  onSubmit,
}: PlaceVisitFormProps) {
  const [input, setInput] = useState<PlaceVisitInput>(() => ({
    name: place?.name ?? '',
    address: place?.address ?? '',
    visitedDate: isoDateTimeToDateInput(place?.visitedAt) || defaultVisitedDate,
    memo: place?.memo ?? '',
    castleId: place?.castleId ?? '',
  }));
  const { data: castleOptions } = useAsyncData<CastleOption[]>(listCastleOptions, []);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validatePlaceVisitInput(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      await onSubmit(input);
      if (!place) {
        setInput({ name: '', address: '', visitedDate: defaultVisitedDate, memo: '', castleId: '' });
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
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}

      <label className="field">
        <span>場所名</span>
        <input
          value={input.name}
          onChange={(event) => setInput({ ...input, name: event.target.value })}
          placeholder="例: 金沢城公園"
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>訪問日</span>
          <input
            type="date"
            value={input.visitedDate}
            onChange={(event) => setInput({ ...input, visitedDate: event.target.value })}
          />
        </label>

        <label className="field">
          <span>住所</span>
          <input
            value={input.address}
            onChange={(event) => setInput({ ...input, address: event.target.value })}
            placeholder="任意"
          />
        </label>
      </div>

      <label className="field">
        <span>城コレクション連携</span>
        <select
          value={input.castleId}
          onChange={(event) => setInput({ ...input, castleId: event.target.value })}
        >
          <option value="">連携しない</option>
          {(castleOptions ?? []).map((castle) => (
            <option key={castle.id} value={castle.id}>{castle.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>メモ</span>
        <textarea
          value={input.memo}
          onChange={(event) => setInput({ ...input, memo: event.target.value })}
          rows={3}
        />
      </label>

      <div className="form-actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? '保存中...' : submitLabel}
        </button>
        {onCancel && (
          <button className="button" type="button" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
