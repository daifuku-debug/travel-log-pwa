export function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return toDateInputValue(date) === value;
}

export function compareDateInputValuesDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
}

export function formatCompactDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return startDate.replaceAll('-', '.');
  const compactEnd = startDate.slice(0, 4) === endDate.slice(0, 4)
    ? endDate.slice(5).replace('-', '.')
    : endDate.replaceAll('-', '.');
  return `${startDate.replaceAll('-', '.')} - ${compactEnd}`;
}

export function dateInputToIsoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00`).toISOString();
}

export function isoDateTimeToDateInput(value?: string): string {
  if (!value) return '';
  return toDateInputValue(new Date(value));
}
