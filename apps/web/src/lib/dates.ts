import { format, parseISO } from 'date-fns';

/** `YYYY-MM` of a date, in the browser's local time. */
export function monthOf(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** `DD/MM/YYYY - Weekday` for a `YYYY-MM-DD` calendar date. */
export function groupTitle(date: string): string {
  return format(parseISO(date), 'dd/MM/yyyy - EEEE');
}
