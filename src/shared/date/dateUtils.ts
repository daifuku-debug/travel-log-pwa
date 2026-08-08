export function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return toDateInputValue(date) === value;
}

export function isValidTimeInputValue(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
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

export function dateTimeInputToIsoDateTime(dateValue: string, timeValue: string): string | undefined {
  if (!isValidDateInputValue(dateValue) || !isValidTimeInputValue(timeValue)) return undefined;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (toDateInputValue(date) !== dateValue || toTimeInputValue(date) !== timeValue) return undefined;
  return date.toISOString();
}

export function isoDateTimeToDateInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toDateInputValue(date);
}

export function isoDateTimeToTimeInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toTimeInputValue(date);
}
