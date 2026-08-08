import { useId, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import type { PlaceVisit } from '../../../domain/models/trip';
import { listCastleOptions, type CastleOption } from '../../castles/castleService';
import {
  isoDateTimeToDateInput,
  isoDateTimeToTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from '../../../shared/date/dateUtils';
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
  const [input, setInput] = useState<PlaceVisitInput>(() => createInitialInput(place, defaultVisitedDate));
  const { data: castleOptions } = useAsyncData<CastleOption[]>(listCastleOptions, []);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fieldIdPrefix = useId();
  const arrivalTimeId = `${fieldIdPrefix}-place-arrival-time`;
  const departureDateId = `${fieldIdPrefix}-place-departure-date`;
  const departureTimeId = `${fieldIdPrefix}-place-departure-time`;

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
        setInput(createInitialInput(undefined, defaultVisitedDate));
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
            onChange={(event) => {
              const visitedDate = event.target.value;
              setInput({
                ...input,
                visitedDate,
                departureDate: !input.departureDate || input.departureDate === input.visitedDate
                  ? visitedDate
                  : input.departureDate,
              });
            }}
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

      <fieldset className="visit-time-fields">
        <legend>滞在時間 <span>任意</span></legend>
        <div className="visit-time-row">
          <label className="field" htmlFor={arrivalTimeId}>
            <span>到着時刻</span>
            <input
              id={arrivalTimeId}
              type="time"
              value={input.arrivalTime}
              onChange={(event) => setInput({ ...input, arrivalTime: event.target.value })}
            />
          </label>
          <button className="button visit-time-now" type="button" onClick={() => setArrivalToNow(setInput)}>
            今
          </button>
        </div>

        <div className="visit-time-row visit-time-row--departure">
          <label className="field" htmlFor={departureDateId}>
            <span>出発日</span>
            <input
              id={departureDateId}
              type="date"
              value={input.departureDate}
              onChange={(event) => setInput({ ...input, departureDate: event.target.value })}
            />
          </label>
          <label className="field" htmlFor={departureTimeId}>
            <span>出発時刻</span>
            <input
              id={departureTimeId}
              type="time"
              value={input.departureTime}
              onChange={(event) => setInput({ ...input, departureTime: event.target.value })}
            />
          </label>
          <button className="button visit-time-now" type="button" onClick={() => setDepartureToNow(setInput)}>
            今
          </button>
        </div>
      </fieldset>

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

function createInitialInput(place?: PlaceVisit, defaultVisitedDate = ''): PlaceVisitInput {
  const visitedDate = isoDateTimeToDateInput(place?.arrivalAt ?? place?.visitedAt) || defaultVisitedDate;
  return {
    name: place?.name ?? '',
    address: place?.address ?? '',
    visitedDate,
    arrivalTime: isoDateTimeToTimeInput(place?.arrivalAt),
    departureDate: isoDateTimeToDateInput(place?.departureAt) || visitedDate,
    departureTime: isoDateTimeToTimeInput(place?.departureAt),
    memo: place?.memo ?? '',
    castleId: place?.castleId ?? '',
  };
}

function setArrivalToNow(setInput: Dispatch<SetStateAction<PlaceVisitInput>>) {
  const now = new Date();
  const visitedDate = toDateInputValue(now);
  setInput((current) => ({
    ...current,
    visitedDate,
    arrivalTime: toTimeInputValue(now),
    departureDate: !current.departureDate || current.departureDate === current.visitedDate
      ? visitedDate
      : current.departureDate,
  }));
}

function setDepartureToNow(setInput: Dispatch<SetStateAction<PlaceVisitInput>>) {
  const now = new Date();
  setInput((current) => ({
    ...current,
    departureDate: toDateInputValue(now),
    departureTime: toTimeInputValue(now),
  }));
}
