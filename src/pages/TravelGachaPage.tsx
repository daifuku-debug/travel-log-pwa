import { useMemo, useState, type FormEvent } from 'react';
import type {
  TravelCandidate,
  TravelGachaDraw,
  TravelGachaMode,
  TravelGachaRandomnessLevel,
  TravelGachaSettings,
  TravelGachaTransportMode,
  TravelStyleTag,
} from '../domain/models/travelGacha';
import {
  acceptTravelGachaDraw,
  defaultTravelGachaSettings,
  drawTravelGacha,
  listRecentTravelGachaDraws,
  previewTravelGacha,
  type TravelGachaResult,
} from '../features/travelGacha/travelGachaService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

const MODE_LABELS: Record<TravelGachaMode, string> = {
  random: '完全ランダム',
  condition: '条件付き',
  unvisited: '未訪問',
  wishlist: '行きたい場所',
  castle: '城',
  nearby: '近場',
  revisit: '再訪',
  omakase: 'おまかせ',
};

const RANDOMNESS_LABELS: Record<TravelGachaRandomnessLevel, string> = {
  realistic: '現実重視',
  balanced: 'バランス',
  adventure: '冒険重視',
  chaos: '完全ランダム',
};

const TRANSPORT_OPTIONS: Array<{ value: TravelGachaTransportMode; label: string }> = [
  { value: 'train', label: '電車' },
  { value: 'shinkansen', label: '新幹線' },
  { value: 'bus', label: 'バス' },
  { value: 'car', label: '車' },
  { value: 'flight', label: '飛行機' },
  { value: 'ship', label: '船' },
  { value: 'bike', label: '自転車' },
  { value: 'walk', label: '徒歩' },
  { value: 'any', label: '指定なし' },
];

const STYLE_OPTIONS: Array<{ value: TravelStyleTag; label: string }> = [
  { value: 'castle', label: '城' },
  { value: 'gourmet', label: 'グルメ' },
  { value: 'onsen', label: '温泉' },
  { value: 'nature', label: '自然' },
  { value: 'city_walk', label: '街歩き' },
  { value: 'photo', label: '写真' },
  { value: 'history', label: '歴史' },
  { value: 'collection', label: '収集' },
];

export function TravelGachaPage() {
  const [mode, setMode] = useState<TravelGachaMode>('condition');
  const [settings, setSettings] = useState<TravelGachaSettings>(defaultTravelGachaSettings);
  const [result, setResult] = useState<TravelGachaResult>();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [historyKey, setHistoryKey] = useState(0);
  const { data: history, error: historyError, loading: historyLoading } = useAsyncData(() => listRecentTravelGachaDraws(8), [historyKey]);

  const selectedCandidate = result?.draw?.candidateSnapshot;
  const candidatePreview = useMemo(() => result?.candidates.slice(0, 12) ?? [], [result]);

  async function runPreview() {
    setBusy(true);
    setFormError('');
    try {
      setResult(await previewTravelGacha(adjustSettingsForMode(mode, settings)));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '候補の確認に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  async function runDraw(rerolledFromDrawId?: string) {
    setBusy(true);
    setFormError('');
    try {
      const next = await drawTravelGacha(mode, adjustSettingsForMode(mode, settings), rerolledFromDrawId);
      setResult(next);
      setHistoryKey((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '抽選に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  async function acceptDraw(draw: TravelGachaDraw) {
    setBusy(true);
    setFormError('');
    try {
      const accepted = await acceptTravelGachaDraw(draw.id);
      setResult((current) => current ? { ...current, draw: accepted } : current);
      setHistoryKey((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '採用に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="page-heading travel-gacha-hero">
        <h1>旅ガチャ</h1>
        <p>予算、移動時間、未訪問、行きたい場所、城コレクションから、次の旅先を楽しく抽選します。</p>
      </section>

      <div className="travel-gacha-layout">
        <section className="card">
          <h2>条件</h2>
          <TravelGachaForm
            mode={mode}
            settings={settings}
            onModeChange={setMode}
            onSettingsChange={setSettings}
            onPreview={() => void runPreview()}
            onDraw={() => void runDraw()}
            busy={busy}
          />
          {formError && <div className="form-errors">{formError}</div>}
        </section>

        <section className="card travel-gacha-result-card">
          <h2>抽選結果</h2>
          {busy && <LoadingState />}
          {!busy && selectedCandidate ? (
            <GachaResultCard
              draw={result.draw!}
              candidate={selectedCandidate}
              onAccept={() => void acceptDraw(result.draw!)}
              onReroll={() => void runDraw(result.draw?.id)}
              busy={busy}
            />
          ) : !busy && result ? (
            <div>
              <EmptyState>抽選できる候補が見つかりませんでした。</EmptyState>
              {result.suggestions.length > 0 && <p className="muted">おすすめ緩和: {result.suggestions.join(' / ')}</p>}
            </div>
          ) : (
            <EmptyState>条件を決めて、旅ガチャを引いてみましょう。</EmptyState>
          )}
        </section>

        <section className="card travel-gacha-wide">
          <h2>候補一覧</h2>
          {result && result.candidates.length === 0 ? (
            <div>
              <EmptyState>条件に合う候補がありません。</EmptyState>
              {result.suggestions.length > 0 && <p className="muted">おすすめ緩和: {result.suggestions.join(' / ')}</p>}
            </div>
          ) : (
            <CandidateList candidates={candidatePreview} />
          )}
        </section>

        <section className="card travel-gacha-wide">
          <h2>最近の旅ガチャ履歴</h2>
          {historyLoading && <LoadingState />}
          {historyError && <ErrorState error={historyError} />}
          {history && <GachaHistory draws={history} />}
        </section>
      </div>
    </>
  );
}

function TravelGachaForm({
  mode,
  settings,
  onModeChange,
  onSettingsChange,
  onPreview,
  onDraw,
  busy,
}: {
  mode: TravelGachaMode;
  settings: TravelGachaSettings;
  onModeChange: (mode: TravelGachaMode) => void;
  onSettingsChange: (settings: TravelGachaSettings) => void;
  onPreview: () => void;
  onDraw: () => void;
  busy: boolean;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onDraw();
  }
  return (
    <form className="form form--compact" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>ガチャ</span>
          <select value={mode} onChange={(event) => onModeChange(event.target.value as TravelGachaMode)}>
            {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>出発地</span>
          <input
            value={settings.departureLabel}
            placeholder="最寄り駅や市区町村でOK"
            onChange={(event) => onSettingsChange({ ...settings, departureLabel: event.target.value })}
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>出発日</span>
          <input type="date" value={settings.departureDate ?? ''} onChange={(event) => onSettingsChange({ ...settings, departureDate: event.target.value || undefined })} />
        </label>
        <label className="field">
          <span>旅行日数</span>
          <input type="number" min="1" max="14" value={settings.tripDurationDays} onChange={(event) => onSettingsChange({ ...settings, tripDurationDays: Number(event.target.value) })} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>最大予算</span>
          <input type="number" min="0" step="1000" value={settings.maxBudget ?? ''} onChange={(event) => onSettingsChange({ ...settings, maxBudget: event.target.value ? Number(event.target.value) : undefined })} />
        </label>
        <label className="field">
          <span>片道移動時間 分</span>
          <input type="number" min="0" step="30" value={settings.maxOneWayTravelMinutes ?? ''} onChange={(event) => onSettingsChange({ ...settings, maxOneWayTravelMinutes: event.target.value ? Number(event.target.value) : undefined })} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>旅行タイプ</span>
          <select value={settings.stayType} onChange={(event) => onSettingsChange({ ...settings, stayType: event.target.value as TravelGachaSettings['stayType'] })}>
            <option value="dayTrip">日帰り</option>
            <option value="overnight">宿泊</option>
          </select>
        </label>
        <label className="field">
          <span>ランダム度</span>
          <select value={settings.randomnessLevel} onChange={(event) => onSettingsChange({ ...settings, randomnessLevel: event.target.value as TravelGachaRandomnessLevel })}>
            {Object.entries(RANDOMNESS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="option-fieldset">
        <legend>移動手段</legend>
        <div className="option-grid">
          {TRANSPORT_OPTIONS.map((option) => (
            <label className="checkbox-field" key={option.value}>
              <input
                type="checkbox"
                checked={settings.transportModes.includes(option.value)}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  transportModes: toggleArray(settings.transportModes, option.value, event.target.checked),
                })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="option-fieldset">
        <legend>旅の気分</legend>
        <div className="option-grid">
          {STYLE_OPTIONS.map((option) => (
            <label className="checkbox-field" key={option.value}>
              <input
                type="checkbox"
                checked={settings.travelStyleTags.includes(option.value)}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  travelStyleTags: toggleArray(settings.travelStyleTags, option.value, event.target.checked),
                })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="inline-actions">
        <label className="checkbox-field filter-checkbox">
          <input type="checkbox" checked={settings.prioritizeUnvisited} onChange={(event) => onSettingsChange({ ...settings, prioritizeUnvisited: event.target.checked })} />
          未訪問優先
        </label>
        <label className="checkbox-field filter-checkbox">
          <input type="checkbox" checked={settings.prioritizeWishlist} onChange={(event) => onSettingsChange({ ...settings, prioritizeWishlist: event.target.checked })} />
          行きたい場所優先
        </label>
        <label className="checkbox-field filter-checkbox">
          <input type="checkbox" checked={settings.includeVisited} onChange={(event) => onSettingsChange({ ...settings, includeVisited: event.target.checked })} />
          再訪を含める
        </label>
        <label className="checkbox-field filter-checkbox">
          <input type="checkbox" checked={settings.includeRecentlyDrawn} onChange={(event) => onSettingsChange({ ...settings, includeRecentlyDrawn: event.target.checked })} />
          最近の抽選も含める
        </label>
      </div>
      <div className="inline-actions">
        <button className="button" type="button" onClick={onPreview} disabled={busy}>候補を見る</button>
        <button className="button button--primary travel-gacha-button" type="submit" disabled={busy}>旅ガチャを引く</button>
      </div>
    </form>
  );
}

function GachaResultCard({
  draw,
  candidate,
  onAccept,
  onReroll,
  busy,
}: {
  draw: TravelGachaDraw;
  candidate: TravelCandidate;
  onAccept: () => void;
  onReroll: () => void;
  busy: boolean;
}) {
  return (
    <div className="travel-ticket">
      <div className="travel-ticket__header">
        <span>{MODE_LABELS[draw.mode]}</span>
        <strong>{candidate.isVisited ? '再訪' : candidate.isWishlist ? '行きたい' : candidate.sourceType === 'castle' ? '城めぐり' : '旅先候補'}</strong>
      </div>
      <h3>{candidate.name}</h3>
      <p>{candidate.description || '既存データから選ばれた旅先です。'}</p>
      <div className="summary-grid">
        <div className="summary-card"><strong>{candidate.prefectureName || '地域未設定'}</strong><span>都道府県</span></div>
        <div className="summary-card"><strong>約{candidate.estimatedTravelTimeMinutes}分</strong><span>片道目安</span></div>
        <div className="summary-card"><strong>{formatYenRange(candidate.costEstimate.minTotalEstimatedCost, candidate.costEstimate.maxTotalEstimatedCost)}</strong><span>概算予算</span></div>
        <div className="summary-card"><strong>{candidate.score}</strong><span>旅ガチャスコア</span></div>
      </div>
      <ul className="muted-list">
        {candidate.scoreReasons.map((reason) => <li key={reason}>{reason}</li>)}
        <li>{candidate.costEstimate.estimateReasons.join(' ')}</li>
      </ul>
      <div className="inline-actions">
        <button className="button button--primary" type="button" onClick={onAccept} disabled={busy || Boolean(draw.acceptedAt)}>
          {draw.acceptedAt ? '採用済み' : 'この旅に決める'}
        </button>
        <button className="button" type="button" onClick={onReroll} disabled={busy}>もう一度引く</button>
      </div>
    </div>
  );
}

function CandidateList({ candidates }: { candidates: TravelCandidate[] }) {
  if (candidates.length === 0) return <EmptyState>まだ候補を表示していません。</EmptyState>;
  return (
    <div className="candidate-list travel-candidate-list">
      {candidates.map((candidate) => (
        <div className="candidate-row" key={candidate.id}>
          <div>
            <strong>{candidate.name}</strong>
            <div className="list-item__meta">
              {candidate.prefectureName || candidate.sourceType} / 約{candidate.estimatedTravelTimeMinutes}分 / {formatYenRange(candidate.costEstimate.minTotalEstimatedCost, candidate.costEstimate.maxTotalEstimatedCost)}
            </div>
            <div className="list-item__meta">{candidate.scoreReasons.slice(0, 2).join(' / ')}</div>
          </div>
          <span className="confidence-badge">{candidate.isVisited ? '訪問済み' : '未訪問'}</span>
        </div>
      ))}
    </div>
  );
}

function GachaHistory({ draws }: { draws: TravelGachaDraw[] }) {
  if (draws.length === 0) return <EmptyState>旅ガチャ履歴はまだありません。</EmptyState>;
  return (
    <div className="list">
      {draws.map((draw) => (
        <div className="list-item" key={draw.id}>
          <div>
            <p className="list-item__title">{draw.candidateSnapshot.name}</p>
            <div className="list-item__meta">
              {MODE_LABELS[draw.mode]} / {new Date(draw.drawnAt).toLocaleString('ja-JP')} / 候補{draw.candidateCount}件
            </div>
          </div>
          <span className="muted">{draw.acceptedAt ? '採用済み' : '未採用'}</span>
        </div>
      ))}
    </div>
  );
}

function adjustSettingsForMode(mode: TravelGachaMode, settings: TravelGachaSettings): TravelGachaSettings {
  if (mode === 'unvisited') return { ...settings, includeVisited: false, prioritizeUnvisited: true, candidateScope: 'prefecture' };
  if (mode === 'wishlist') return { ...settings, candidateScope: 'wishlist', prioritizeWishlist: true };
  if (mode === 'castle') return { ...settings, candidateScope: 'castle', travelStyleTags: ['castle'] };
  if (mode === 'nearby') return { ...settings, stayType: 'dayTrip', maxOneWayTravelMinutes: Math.min(settings.maxOneWayTravelMinutes ?? 120, 120) };
  if (mode === 'revisit') return { ...settings, candidateScope: 'visited', includeVisited: true };
  if (mode === 'random') return { ...settings, randomnessLevel: 'chaos' };
  if (mode === 'omakase') return { ...settings, prioritizeUnvisited: true, prioritizeWishlist: true, randomnessLevel: 'adventure' };
  return settings;
}

function toggleArray<T>(values: T[], value: T, checked: boolean): T[] {
  if (checked) return [...new Set([...values, value])];
  return values.filter((item) => item !== value);
}

function formatYenRange(min: number, max: number): string {
  return `約${min.toLocaleString()}〜${max.toLocaleString()}円`;
}
