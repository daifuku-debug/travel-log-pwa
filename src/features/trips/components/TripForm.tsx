import { useState, type FormEvent } from 'react';
import type { Trip } from '../../../domain/models/trip';
import { todayDateInputValue } from '../../../shared/date/dateUtils';
import {
  Button,
  FormActions,
  FormSection,
  InlineError,
  SelectField,
  TextareaField,
  TextInput,
} from '../../../shared/ui';
import { type TripInput, validateTripInput } from '../tripService';

interface TripFormProps {
  trip?: Trip;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (input: TripInput) => Promise<void>;
}

interface TripFieldErrors {
  title?: string;
  startDate?: string;
  endDate?: string;
}

export function TripForm({ trip, submitLabel, cancelTo, onSubmit }: TripFormProps) {
  const [input, setInput] = useState<TripInput>(() => ({
    title: trip?.title ?? '',
    startDate: trip?.startDate ?? todayDateInputValue(),
    endDate: trip?.endDate ?? todayDateInputValue(),
    tripType: trip?.tripType ?? 'dayTrip',
    companionsText: trip?.companions.join(', ') ?? '',
    purpose: trip?.purpose ?? '',
    memo: trip?.memo ?? '',
  }));
  const [fieldErrors, setFieldErrors] = useState<TripFieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const validationErrors = validateTripInput(input);
    if (validationErrors.length > 0) {
      setFieldErrors(toFieldErrors(validationErrors));
      setSubmitError('入力内容を確認してください。');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setSubmitError('');
    try {
      await onSubmit(input);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '保存に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form trip-form" onSubmit={handleSubmit} noValidate>
      {submitError && <InlineError title="保存できません" message={submitError} />}

      <FormSection title="基本情報" description="旅の一覧で最初に表示される内容です。">
        <TextInput
          id="trip-title"
          label="タイトル"
          required
          autoComplete="off"
          value={input.title}
          error={fieldErrors.title}
          onChange={(event) => setInput({ ...input, title: event.target.value })}
          placeholder="例: 金沢 週末旅行"
        />
        <SelectField
          id="trip-type"
          label="日帰り／宿泊"
          value={input.tripType}
          onChange={(event) => setInput({ ...input, tripType: event.target.value as TripInput['tripType'] })}
        >
          <option value="dayTrip">日帰り</option>
          <option value="overnight">宿泊</option>
        </SelectField>
      </FormSection>

      <FormSection title="日程" description="開始日と終了日を設定します。">
        <div className="form-grid">
          <TextInput
            id="trip-start-date"
            label="開始日"
            type="date"
            required
            value={input.startDate}
            error={fieldErrors.startDate}
            onChange={(event) => setInput({ ...input, startDate: event.target.value })}
          />
          <TextInput
            id="trip-end-date"
            label="終了日"
            type="date"
            required
            value={input.endDate}
            error={fieldErrors.endDate}
            onChange={(event) => setInput({ ...input, endDate: event.target.value })}
          />
        </div>
      </FormSection>

      <FormSection title="旅の内容">
        <TextInput
          id="trip-companions"
          label="同行者"
          value={input.companionsText}
          helperText="複数いる場合はカンマで区切ってください。空欄ならひとり旅として表示します。"
          onChange={(event) => setInput({ ...input, companionsText: event.target.value })}
          placeholder="例: 家族, 友人"
        />
        <TextInput
          id="trip-purpose"
          label="目的"
          value={input.purpose}
          onChange={(event) => setInput({ ...input, purpose: event.target.value })}
          placeholder="例: 城めぐり"
        />
        <TextareaField
          id="trip-memo"
          label="メモ"
          value={input.memo}
          onChange={(event) => setInput({ ...input, memo: event.target.value })}
          rows={5}
          placeholder="予定や旅の感想を自由に残せます"
        />
      </FormSection>

      <FormActions>
        <Button variant="primary" type="submit" loading={submitting}>{submitLabel}</Button>
        <Button to={cancelTo} disabled={submitting}>キャンセル</Button>
      </FormActions>
    </form>
  );
}

function toFieldErrors(errors: string[]): TripFieldErrors {
  const result: TripFieldErrors = {};
  for (const error of errors) {
    if (error.includes('タイトル')) result.title = error;
    else if (error.includes('開始日')) result.startDate = error;
    else if (error.includes('終了日')) result.endDate = error;
  }
  return result;
}
