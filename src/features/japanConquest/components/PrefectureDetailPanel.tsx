import { useEffect, useState, type FormEvent } from 'react';
import type { PrefectureView } from '../japanConquestLogic';
import { REGION_LABELS, STATUS_LABELS } from '../japanConquestLogic';
import {
  type PrefectureVisitInput,
  updatePrefectureVisit,
  validatePrefectureVisitInput,
} from '../japanConquestService';

interface PrefectureDetailPanelProps {
  view?: PrefectureView;
  onSaved: () => void;
}

export function PrefectureDetailPanel({ view, onSaved }: PrefectureDetailPanelProps) {
  const [input, setInput] = useState<PrefectureVisitInput>(() => createInput(view));
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setInput(createInput(view));
    setErrors([]);
  }, [view]);

  if (!view) {
    return (
      <section className="card detail-panel">
        <h2>都道府県詳細</h2>
        <p className="muted">地図または一覧から都道府県を選択してください。</p>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view) return;
    const validationErrors = validatePrefectureVisitInput(input);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      await updatePrefectureVisit(view.master.code, input);
      onSaved();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '保存に失敗しました。']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card detail-panel">
      <div className="section-head">
        <div>
          <h2>{view.master.nameJa}</h2>
          <p className="muted">{REGION_LABELS[view.master.region]} / 県庁所在地: {view.master.capital}</p>
        </div>
        <span className={`status-badge status-${view.visit.status}`}>{STATUS_LABELS[view.visit.status]}</span>
      </div>

      <form className="form form--compact" onSubmit={handleSubmit}>
        {errors.length > 0 && (
          <div className="form-errors">
            {errors.map((error) => <div key={error}>{error}</div>)}
          </div>
        )}

        <label className="field">
          <span>訪問状態</span>
          <select
            value={input.status}
            onChange={(event) => setInput({ ...input, status: event.target.value as PrefectureVisitInput['status'] })}
          >
            <option value="unvisited">未訪問</option>
            <option value="passed">通過した</option>
            <option value="visited">訪問した</option>
            <option value="stayed">宿泊した</option>
          </select>
        </label>

        <div className="form-grid">
          <label className="field">
            <span>初回訪問日</span>
            <input
              type="date"
              value={input.firstVisitedAt}
              onChange={(event) => setInput({ ...input, firstVisitedAt: event.target.value })}
            />
          </label>
          <label className="field">
            <span>最終訪問日</span>
            <input
              type="date"
              value={input.lastVisitedAt}
              onChange={(event) => setInput({ ...input, lastVisitedAt: event.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span>訪問回数</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={input.visitCount}
            onChange={(event) => setInput({ ...input, visitCount: Number(event.target.value) })}
          />
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={input.isFavorite}
            onChange={(event) => setInput({ ...input, isFavorite: event.target.checked })}
          />
          お気に入り
        </label>

        <label className="field">
          <span>メモ</span>
          <textarea
            rows={4}
            value={input.note}
            onChange={(event) => setInput({ ...input, note: event.target.value })}
          />
        </label>

        <div className="status-banner">関連する旅行記録は今後対応予定です。</div>

        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </section>
  );
}

function createInput(view?: PrefectureView): PrefectureVisitInput {
  return {
    status: view?.visit.status ?? 'unvisited',
    firstVisitedAt: view?.visit.firstVisitedAt ?? '',
    lastVisitedAt: view?.visit.lastVisitedAt ?? '',
    visitCount: view?.visit.visitCount ?? 0,
    note: view?.visit.note ?? '',
    isFavorite: view?.visit.isFavorite ?? false,
  };
}
