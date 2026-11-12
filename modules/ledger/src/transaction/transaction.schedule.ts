import type { InstalmentPlan, Recurrence } from './transaction.types.js';

/**
 * The schedule of a transaction: pure date arithmetic on `YYYY-MM-DD` text.
 * Month-end clamping is anchored on the start date: a monthly entry that starts on the 31st
 * falls on the last day of shorter months and returns to the 31st afterwards.
 */
export interface ScheduleSpec {
  startDate: string;
  recurrence: Recurrence | null;
  instalment: InstalmentPlan | null;
}

interface Ymd {
  y: number;
  m: number;
  d: number;
}

function parse(date: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function format(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dayNumber({ y, m, d }: Ymd): number {
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function monthIndex(y: number, m: number): number {
  return y * 12 + (m - 1);
}

/** True when `date` is a real calendar date written `YYYY-MM-DD`. */
export function isValidDate(date: string): boolean {
  return parse(date) !== null;
}

/** The dates of `month` (`YYYY-MM`) on which the transaction falls, ascending. */
export function occurrencesInMonth(spec: ScheduleSpec, month: string): string[] {
  const target = parse(`${month}-01`);
  const start = parse(spec.startDate);
  if (!target || !start) return [];

  const dim = daysInMonth(target.y, target.m);
  const diff = monthIndex(target.y, target.m) - monthIndex(start.y, start.m);
  const clamped = format(target.y, target.m, Math.min(start.d, dim));

  if (spec.instalment) {
    if (diff < 0 || spec.instalment.startNumber + diff > spec.instalment.total) return [];
    return [clamped];
  }

  switch (spec.recurrence) {
    case null:
      return diff === 0 ? [spec.startDate] : [];
    case 'monthly':
      return diff >= 0 ? [clamped] : [];
    case 'annually':
      return diff >= 0 && diff % 12 === 0 ? [clamped] : [];
    case 'daily':
    case 'weekly': {
      const step = spec.recurrence === 'daily' ? 1 : 7;
      const startDay = dayNumber(start);
      const dates: string[] = [];
      for (let d = 1; d <= dim; d += 1) {
        const days = dayNumber({ y: target.y, m: target.m, d }) - startDay;
        if (days >= 0 && days % step === 0) dates.push(format(target.y, target.m, d));
      }
      return dates;
    }
  }
}

/** True when the transaction falls on `date`. */
export function isOccurrenceDate(spec: ScheduleSpec, date: string): boolean {
  return parse(date) !== null && occurrencesInMonth(spec, date.slice(0, 7)).includes(date);
}

/** The instalment number of the occurrence on `date`, or null for a transaction with no instalments. */
export function instalmentNumber(spec: ScheduleSpec, date: string): number | null {
  const start = parse(spec.startDate);
  const target = parse(date);
  if (!spec.instalment || !start || !target) return null;
  return (
    spec.instalment.startNumber +
    (monthIndex(target.y, target.m) - monthIndex(start.y, start.m))
  );
}
