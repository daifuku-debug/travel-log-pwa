import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, Card, CheckboxField, InlineError, SelectField, TextareaField, TextInput } from '../../../shared/ui';
import type { PrefectureView } from '../japanConquestLogic';
import { REGION_LABELS, STATUS_LABELS } from '../japanConquestLogic';
import { type PrefectureVisitInput, updatePrefectureVisit, validatePrefectureVisitInput } from '../japanConquestService';

interface PrefectureDetailPanelProps {
  view?: PrefectureView;
  onSaved: () => void;
}

export function PrefectureDetailPanel({ view, onSaved }: PrefectureDetailPanelProps) {
  const [input, setInput] = useState<PrefectureVisitInput>(() => createInput(view));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setInput(createInput(view));
    setFormError('');
  }, [view]);

  if (!view) {
    return (
      <Card className="detail-panel map-selection-empty" title="都道府県の詳細">
        <p>地図または一覧から都道府県を選択してください。</p>
        <p className="muted">訪問状態、日付、回数、メモを端末内へ保存できます。</p>
      </Card>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view || submitting) return;
    const validationErrors = validatePrefectureVisitInput(input);
    if (validationErrors.length > 0) {
      setFormError(validationErrors.join(' '));
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await updatePrefectureVisit(view.master.code, input);
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '保存に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      className="detail-panel map-selection-panel"
      title={view.master.nameJa}
      description={`${REGION_LABELS[view.master.region]} / 県庁所在地: ${view.master.capital}`}
      actions={<Badge variant={badgeVariant(view.visit.status)}>{STATUS_LABELS[view.visit.status]}</Badge>}
    >
      <form className="form form--compact" onSubmit={handleSubmit} noValidate>
        {formError && <InlineError title="保存できません" message={formError} compact />}
        <SelectField
          label="訪問状態"
          value={input.status}
          onChange={(event) => setInput({ ...input, status: event.target.value as PrefectureVisitInput['status'] })}
        >
          <option value="unvisited">未訪問</option><option value="passed">通過した</option>
          <option value="landed">降り立った</option><option value="visited">訪問した</option>
          <option value="stayed">宿泊した</option><option value="lived">住んだことがある</option>
        </SelectField>
        <div className="form-grid">
          <TextInput label="初回訪問日" type="date" value={input.firstVisitedAt} onChange={(event) => setInput({ ...input, firstVisitedAt: event.target.value })} />
          <TextInput label="最終訪問日" type="date" value={input.lastVisitedAt} onChange={(event) => setInput({ ...input, lastVisitedAt: event.target.value })} />
        </div>
        <TextInput label="訪問回数" type="number" min="0" inputMode="numeric" value={input.visitCount} onChange={(event) => setInput({ ...input, visitCount: Number(event.target.value) })} />
        <CheckboxField label="お気に入り" checked={input.isFavorite} onChange={(event) => setInput({ ...input, isFavorite: event.target.checked })} />
        <TextareaField label="メモ" rows={4} value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} />
        <p className="muted map-related-note">関連する旅行記録は今後対応予定です。</p>
        <Button variant="primary" type="submit" loading={submitting}>訪問情報を保存</Button>
      </form>
    </Card>
  );
}

function createInput(view?: PrefectureView): PrefectureVisitInput {
  return {
    status: view?.visit.status ?? 'unvisited', firstVisitedAt: view?.visit.firstVisitedAt ?? '',
    lastVisitedAt: view?.visit.lastVisitedAt ?? '', visitCount: view?.visit.visitCount ?? 0,
    note: view?.visit.note ?? '', isFavorite: view?.visit.isFavorite ?? false,
  };
}

function badgeVariant(status: PrefectureView['visit']['status']): 'neutral' | 'warning' | 'info' | 'success' | 'primary' {
  if (status === 'unvisited') return 'neutral';
  if (status === 'passed') return 'warning';
  if (status === 'landed') return 'info';
  if (status === 'visited') return 'success';
  return 'primary';
}
