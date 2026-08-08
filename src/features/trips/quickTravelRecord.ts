import type {
  ManualTimelineEntry,
  QuickExpenseCategory,
  QuickTravelRecordType,
} from '../../domain/models/timeMachine.ts';
import type { PlaceVisit } from '../../domain/models/trip.ts';
import {
  dateTimeInputToIsoDateTime,
  isoDateTimeToDateInput,
  isoDateTimeToTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from '../../shared/date/dateUtils.ts';

export const QUICK_TRAVEL_RECORD_TYPES: ReadonlyArray<{ value: QuickTravelRecordType; label: string; description: string }> = [
  { value: 'meal', label: '食事', description: '店や料理、金額を記録' },
  { value: 'purchase', label: '買い物', description: '買ったものと店を記録' },
  { value: 'memo', label: 'メモ・出来事', description: 'その瞬間の気持ちを記録' },
  { value: 'expense', label: '出費', description: '入場料などの費用を記録' },
];

export const QUICK_EXPENSE_CATEGORIES: ReadonlyArray<{ value: QuickExpenseCategory; label: string }> = [
  { value: 'admission', label: '入場料' },
  { value: 'accommodation', label: '宿泊' },
  { value: 'activity', label: '体験・アクティビティ' },
  { value: 'other', label: 'その他' },
];

export interface QuickTravelRecordInput {
  recordType: QuickTravelRecordType;
  title: string;
  note: string;
  amount: string;
  category: QuickExpenseCategory;
  shopName: string;
  placeVisitId: string;
  date: string;
  time: string;
}

export function createQuickTravelRecordInput(
  recordType: QuickTravelRecordType,
  now = new Date(),
  place?: PlaceVisit,
): QuickTravelRecordInput {
  return {
    recordType,
    title: '',
    note: '',
    amount: '',
    category: 'admission',
    shopName: '',
    placeVisitId: place?.id ?? '',
    date: toDateInputValue(now),
    time: toTimeInputValue(now),
  };
}

export function quickTravelRecordToInput(entry: ManualTimelineEntry): QuickTravelRecordInput {
  return {
    recordType: entry.recordType ?? 'memo',
    title: entry.title ?? '',
    note: entry.note ?? '',
    amount: entry.amount === undefined ? '' : String(entry.amount),
    category: entry.category ?? 'other',
    shopName: entry.shopName ?? '',
    placeVisitId: entry.placeVisitId ?? '',
    date: entry.date,
    time: isoDateTimeToTimeInput(entry.startAt),
  };
}

export function validateQuickTravelRecordInput(input: QuickTravelRecordInput): string[] {
  const errors: string[] = [];
  if (!dateTimeInputToIsoDateTime(input.date, input.time)) errors.push('日時を正しく入力してください。');
  if ((input.recordType === 'meal' || input.recordType === 'purchase') && !input.title.trim()) {
    errors.push(input.recordType === 'meal' ? '店名または食事タイトルを入力してください。' : '品名を入力してください。');
  }
  if (input.recordType === 'memo' && !input.note.trim()) errors.push('出来事やメモを入力してください。');
  if (input.amount && (!Number.isFinite(Number(input.amount)) || Number(input.amount) < 0)) errors.push('金額は0以上の数値で入力してください。');
  if (input.recordType === 'expense' && !input.amount) errors.push('出費の金額を入力してください。');
  return errors;
}

export function buildQuickTravelRecordFields(
  input: QuickTravelRecordInput,
  place?: PlaceVisit,
): Pick<ManualTimelineEntry, 'date' | 'startAt' | 'timePrecision' | 'recordType' | 'title' | 'note' | 'amount' | 'category' | 'shopName' | 'placeVisitId' | 'locationName'> {
  const startAt = dateTimeInputToIsoDateTime(input.date, input.time);
  if (!startAt) throw new Error('日時を正しく入力してください。');
  return {
    date: input.date,
    startAt,
    timePrecision: 'minute',
    recordType: input.recordType,
    title: optionalText(input.title),
    note: optionalText(input.note),
    amount: input.amount ? Math.round(Number(input.amount)) : undefined,
    category: input.recordType === 'expense' ? input.category : undefined,
    shopName: input.recordType === 'purchase' ? optionalText(input.shopName) : undefined,
    placeVisitId: place?.id,
    locationName: place?.name,
  };
}

export function isQuickTravelRecord(entry: ManualTimelineEntry): boolean {
  return QUICK_TRAVEL_RECORD_TYPES.some((type) => type.value === entry.recordType);
}

export function getQuickTravelRecordTypeLabel(type?: QuickTravelRecordType): string {
  return QUICK_TRAVEL_RECORD_TYPES.find((entry) => entry.value === type)?.label ?? 'メモ';
}

export function formatQuickTravelRecordTitle(entry: ManualTimelineEntry): string {
  if (entry.recordType === 'expense') return `出費・${getQuickExpenseCategoryLabel(entry.category)}`;
  if (entry.recordType === 'memo') return entry.title || '旅のメモ';
  return entry.title || getQuickTravelRecordTypeLabel(entry.recordType);
}

export function formatQuickTravelRecordDetail(entry: ManualTimelineEntry): string {
  return [
    entry.shopName,
    entry.locationName,
    entry.amount === undefined ? '' : `${entry.amount.toLocaleString('ja-JP')}円`,
    entry.note,
  ].filter(Boolean).join(' ・ ');
}

export function formatQuickTravelRecordMoment(entry: ManualTimelineEntry): string {
  const time = isoDateTimeToTimeInput(entry.startAt);
  return time || '時刻未設定';
}

export function getQuickTravelRecordDate(entry: ManualTimelineEntry): string {
  return isoDateTimeToDateInput(entry.startAt) || entry.date;
}

function getQuickExpenseCategoryLabel(category?: QuickExpenseCategory): string {
  return QUICK_EXPENSE_CATEGORIES.find((entry) => entry.value === category)?.label ?? 'その他';
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}
