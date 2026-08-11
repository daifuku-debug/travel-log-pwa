import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { ManualTimelineEntry, QuickTravelRecordType } from '../../../domain/models/timeMachine.ts';
import type { PlaceVisit, Trip } from '../../../domain/models/trip.ts';
import { BottomSheet, Button, InlineError, SelectField, TextareaField, TextInput, useToast } from '../../../shared/ui';
import { findInProgressPlaceVisits } from '../placeVisitDateTime.ts';
import { createEditorSaveErrorMessage } from '../editorSaveError.ts';
import {
  QUICK_EXPENSE_CATEGORIES,
  QUICK_TRAVEL_RECORD_TYPES,
  createHistoricalQuickTravelRecordInput,
  createQuickTravelRecordInput,
  formatQuickTravelRecordDetail,
  formatQuickTravelRecordMoment,
  formatQuickTravelRecordTitle,
  getQuickTravelRecordDate,
  getQuickTravelRecordTypeLabel,
  quickTravelRecordToInput,
  type QuickTravelRecordInput,
  validateQuickTravelRecordInput,
  validateQuickTravelRecordTripDate,
} from '../quickTravelRecord.ts';
import { createQuickTravelRecord, updateQuickTravelRecord } from '../quickTravelRecordService.ts';
import type { TripLiveRecordingAvailability } from '../tripLiveRecording.ts';

interface QuickTravelRecordProps {
  tripId: string;
  trip: Pick<Trip, 'startDate' | 'endDate'>;
  liveRecordingAvailability: TripLiveRecordingAvailability;
  places: PlaceVisit[];
  records: ManualTimelineEntry[];
  editRecordId?: string;
  onRequestEdit: (recordId: string) => void;
  onEditorClose: () => void;
  onChanged: () => void;
}

type EditorState =
  | { mode: 'choose' }
  | { mode: 'create'; input: QuickTravelRecordInput }
  | { mode: 'edit'; entryId: string; input: QuickTravelRecordInput };

export function QuickTravelRecord({
  tripId,
  trip,
  liveRecordingAvailability,
  places,
  records,
  editRecordId,
  onRequestEdit,
  onEditorClose,
  onChanged,
}: QuickTravelRecordProps) {
  const { showToast } = useToast();
  const [editor, setEditor] = useState<EditorState>();
  const [showDateTime, setShowDateTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const formId = useId();
  const editorFormRef = useRef<HTMLFormElement>(null);
  const [targeted, setTargeted] = useState(false);
  const activePlace = findInProgressPlaceVisits(places)[0];
  const input = editor && editor.mode !== 'choose' ? editor.input : undefined;
  const isHistoricalCreate = liveRecordingAvailability.state === 'completed';
  const canCreate = liveRecordingAvailability.allowed || isHistoricalCreate;

  useEffect(() => {
    if (!editRecordId) return;
    const record = records.find((entry) => entry.id === editRecordId && !entry.deletedAt);
    if (!record) return;
    openEdit(record);
    setTargeted(true);
    const timer = window.setTimeout(() => setTargeted(false), 1600);
    return () => window.clearTimeout(timer);
  }, [editRecordId, records]);

  function openCreate() {
    if (!canCreate) return;
    setError('');
    setSaveFailed(false);
    setShowDateTime(isHistoricalCreate);
    setEditor({ mode: 'choose' });
  }

  function selectType(recordType: QuickTravelRecordType) {
    setError('');
    setSaveFailed(false);
    setEditor({
      mode: 'create',
      input: isHistoricalCreate
        ? createHistoricalQuickTravelRecordInput(recordType, trip)
        : createQuickTravelRecordInput(recordType, new Date(), activePlace),
    });
  }

  function openEdit(entry: ManualTimelineEntry) {
    setError('');
    setSaveFailed(false);
    setShowDateTime(true);
    setEditor({ mode: 'edit', entryId: entry.id, input: quickTravelRecordToInput(entry) });
  }

  function closeEditor() {
    if (saving) return;
    const wasTargetedEdit = editor?.mode === 'edit' && Boolean(editRecordId);
    setEditor(undefined);
    setError('');
    setSaveFailed(false);
    setTargeted(false);
    if (wasTargetedEdit) onEditorClose();
  }

  function updateInput(patch: Partial<QuickTravelRecordInput>) {
    if (!editor || editor.mode === 'choose') return;
    setEditor({ ...editor, input: { ...editor.input, ...patch } });
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || editor.mode === 'choose' || saving) return;
    const errors = [
      ...validateQuickTravelRecordInput(editor.input),
      ...(editor.mode === 'create' && isHistoricalCreate ? validateQuickTravelRecordTripDate(editor.input, trip) : []),
    ];
    if (errors.length > 0) {
      setError(errors.join('\n'));
      setSaveFailed(false);
      return;
    }
    setSaving(true);
    setError('');
    setSaveFailed(false);
    try {
      if (editor.mode === 'edit') await updateQuickTravelRecord(editor.entryId, editor.input);
      else await createQuickTravelRecord(tripId, editor.input);
      showToast({ title: editor.mode === 'edit' ? '旅先の記録を更新しました' : '旅先の記録を残しました', variant: 'success' });
      setEditor(undefined);
      if (editor.mode === 'edit' && editRecordId) onEditorClose();
      onChanged();
    } catch {
      setError(createEditorSaveErrorMessage('旅先の記録'));
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="quick-visit quick-record" aria-labelledby="quick-record-title">
      <div className="quick-visit__heading">
        <div><span>Moments</span><h2 id="quick-record-title">旅先クイック記録</h2></div>
        {canCreate && <Button onClick={openCreate}>{isHistoricalCreate ? '過去の記録を追加' : '記録を追加'}</Button>}
      </div>
      <p className="quick-visit__hint">{getQuickRecordHint(liveRecordingAvailability)}</p>
      {records.length > 0 && (
        <details className="quick-record__history" open={records.length <= 3}>
          <summary>記録一覧 <span>{records.length}件</span></summary>
          <div className="quick-visit__list">
            {records.map((record) => (
              <div className="quick-visit__place" key={record.id}>
                <div className="quick-visit__place-copy">
                  <span className="quick-record__type">{getQuickTravelRecordTypeLabel(record.recordType)}</span>
                  <strong>{formatQuickTravelRecordTitle(record)}</strong>
                  <time dateTime={record.startAt}>{formatRecordMoment(record)}</time>
                  {formatQuickTravelRecordDetail(record) && <small>{formatQuickTravelRecordDetail(record)}</small>}
                </div>
                <div className="quick-visit__actions"><Button onClick={() => onRequestEdit(record.id)}>詳細を編集</Button></div>
              </div>
            ))}
          </div>
        </details>
      )}

      <BottomSheet
        open={Boolean(editor)}
        onClose={closeEditor}
        title={editor?.mode === 'edit' ? '旅先の記録を編集' : editor?.mode === 'create' ? `${getQuickTravelRecordTypeLabel(editor.input.recordType)}を記録` : '記録の種類を選ぶ'}
        description={editor?.mode === 'choose' ? 'いま残したい記録を選んでください。' : undefined}
        dismissible={!saving}
        initialFocusRef={editor?.mode === 'edit' ? editorFormRef : undefined}
        actions={editor && editor.mode !== 'choose' ? <><Button onClick={closeEditor} disabled={saving}>キャンセル</Button><Button variant="primary" type="submit" form={formId} loading={saving}>{saveFailed ? 'もう一度保存' : editor.mode === 'edit' ? '記録を更新' : '記録する'}</Button></> : undefined}
      >
        {editor?.mode === 'choose' && <RecordTypeChooser onSelect={selectType} />}
        {input && (
          <form
            id={formId}
            ref={editorFormRef}
            className={`quick-record__form${targeted ? ' quick-record__form--targeted' : ''}`}
            onSubmit={saveRecord}
            aria-busy={saving || undefined}
            aria-label={editor?.mode === 'edit' ? '旅先の記録の編集フォーム' : undefined}
            tabIndex={editor?.mode === 'edit' ? -1 : undefined}
          >
            {error && <InlineError message={error} />}
            <RecordFields input={input} updateInput={updateInput} />
            <div className="quick-record__moment">
              <div><span>記録日時</span><strong>{formatInputMoment(input)}</strong></div>
              <Button onClick={() => setShowDateTime((value) => !value)} aria-expanded={showDateTime}>{showDateTime ? '日時を閉じる' : '日時を変更'}</Button>
            </div>
            {showDateTime && <div className="quick-record__date-time">
              <TextInput label="日付" type="date" value={input.date} onChange={(event) => updateInput({ date: event.target.value })} required />
              <TextInput label="時刻" type="time" value={input.time} onChange={(event) => updateInput({ time: event.target.value })} required />
            </div>}
            <SelectField label="訪問場所" value={input.placeVisitId} onChange={(event) => updateInput({ placeVisitId: event.target.value })} helperText="滞在中の場所がある場合は自動で選ばれます。">
              <option value="">関連付けない</option>
              {places.map((place) => <option value={place.id} key={place.id}>{place.name}</option>)}
            </SelectField>
          </form>
        )}
      </BottomSheet>
    </section>
  );
}

function getQuickRecordHint(availability: TripLiveRecordingAvailability): string {
  if (availability.state === 'completed') return '食事や買い物など、旅の記録を日付を確認しながら追記できます。';
  if (availability.state === 'upcoming') return '旅行が始まると、食事や買い物などを手早く記録できます。';
  if (availability.state === 'unknown') return '旅行日程を確認すると、新しい記録を追加できます。';
  return '食事や買い物、その場の出来事を、いまの時刻で手早く残せます。';
}

function RecordTypeChooser({ onSelect }: { onSelect: (type: QuickTravelRecordType) => void }) {
  return <div className="quick-record__types">{QUICK_TRAVEL_RECORD_TYPES.map((type) => (
    <button type="button" key={type.value} onClick={() => onSelect(type.value)}>
      <strong>{type.label}</strong><span>{type.description}</span>
    </button>
  ))}</div>;
}

function RecordFields({ input, updateInput }: {
  input: QuickTravelRecordInput;
  updateInput: (patch: Partial<QuickTravelRecordInput>) => void;
}) {
  if (input.recordType === 'memo') return <>
    <TextareaField label="出来事・メモ" value={input.note} onChange={(event) => updateInput({ note: event.target.value })} rows={4} maxLength={500} placeholder="例: 雨上がりの路地がきれいだった" required autoFocus />
    <TextInput label="タイトル" value={input.title} onChange={(event) => updateInput({ title: event.target.value })} maxLength={120} placeholder="任意" />
  </>;
  if (input.recordType === 'expense') return <>
    <TextInput label="金額" type="number" inputMode="numeric" min="0" step="1" value={input.amount} onChange={(event) => updateInput({ amount: event.target.value })} placeholder="0" required autoFocus />
    <SelectField label="カテゴリ" value={input.category} onChange={(event) => updateInput({ category: event.target.value as QuickTravelRecordInput['category'] })}>
      {QUICK_EXPENSE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
    </SelectField>
    <TextareaField label="メモ" value={input.note} onChange={(event) => updateInput({ note: event.target.value })} rows={3} maxLength={500} placeholder="任意" helperText="交通費・食事・買い物は、それぞれの記録に金額を残すと整理しやすくなります。" />
  </>;
  return <>
    <TextInput label={input.recordType === 'meal' ? '店名または食事タイトル' : '品名'} value={input.title} onChange={(event) => updateInput({ title: event.target.value })} maxLength={120} required autoFocus />
    {input.recordType === 'purchase' && <TextInput label="店名" value={input.shopName} onChange={(event) => updateInput({ shopName: event.target.value })} maxLength={120} placeholder="任意" />}
    <TextInput label="金額" type="number" inputMode="numeric" min="0" step="1" value={input.amount} onChange={(event) => updateInput({ amount: event.target.value })} placeholder="任意" />
    <TextareaField label="メモ" value={input.note} onChange={(event) => updateInput({ note: event.target.value })} rows={3} maxLength={500} placeholder="任意" />
  </>;
}

function formatRecordMoment(record: ManualTimelineEntry): string {
  return `${getQuickTravelRecordDate(record).replaceAll('-', '.')} ${formatQuickTravelRecordMoment(record)}`;
}

function formatInputMoment(input: QuickTravelRecordInput): string {
  return `${input.date.replaceAll('-', '.')} ${input.time}`;
}
