import { describe, expect, it } from 'vitest';
import { instalmentNumber, isOccurrenceDate, occurrencesInMonth, type ScheduleSpec } from '../transaction.schedule.js';

const oneOff = (startDate: string): ScheduleSpec => ({ startDate, recurrence: null, instalment: null });
const every = (recurrence: ScheduleSpec['recurrence'], startDate: string): ScheduleSpec => ({
  startDate,
  recurrence,
  instalment: null,
});
const instalments = (startDate: string, startNumber: number, total: number): ScheduleSpec => ({
  startDate,
  recurrence: 'monthly',
  instalment: { startNumber, total },
});

describe('transaction schedule', () => {
  it('C16 a one-off has a single occurrence on its date', () => {
    const spec = oneOff('2026-11-10');

    expect(occurrencesInMonth(spec, '2026-11')).toEqual(['2026-11-10']);
    expect(occurrencesInMonth(spec, '2026-10')).toEqual([]);
    expect(occurrencesInMonth(spec, '2026-12')).toEqual([]);
  });

  it('C17 daily occurrences start on the start date and never end', () => {
    const spec = every('daily', '2026-11-29');

    expect(occurrencesInMonth(spec, '2026-10')).toEqual([]);
    expect(occurrencesInMonth(spec, '2026-11')).toEqual(['2026-11-29', '2026-11-30']);
    expect(occurrencesInMonth(spec, '2026-12')).toHaveLength(31);
    expect(occurrencesInMonth(spec, '2031-05')).toHaveLength(31);
  });

  it('C18 weekly occurrences fall every seven days', () => {
    const spec = every('weekly', '2026-11-05');

    expect(occurrencesInMonth(spec, '2026-11')).toEqual(['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
    expect(occurrencesInMonth(spec, '2026-12')).toEqual([
      '2026-12-03',
      '2026-12-10',
      '2026-12-17',
      '2026-12-24',
      '2026-12-31',
    ]);
    expect(isOccurrenceDate(spec, '2026-10-29')).toBe(false);
  });

  it('C19 monthly occurrences fall on the start day with no end', () => {
    const spec = every('monthly', '2026-11-05');

    expect(occurrencesInMonth(spec, '2026-10')).toEqual([]);
    expect(occurrencesInMonth(spec, '2026-11')).toEqual(['2026-11-05']);
    expect(occurrencesInMonth(spec, '2027-06')).toEqual(['2027-06-05']);
  });

  it('C20 monthly occurrences clamp to the last day and return to the start day', () => {
    const spec = every('monthly', '2026-01-31');

    expect(occurrencesInMonth(spec, '2026-01')).toEqual(['2026-01-31']);
    expect(occurrencesInMonth(spec, '2026-02')).toEqual(['2026-02-28']);
    expect(occurrencesInMonth(spec, '2026-03')).toEqual(['2026-03-31']);
    expect(occurrencesInMonth(spec, '2026-04')).toEqual(['2026-04-30']);
    expect(occurrencesInMonth(every('monthly', '2028-01-31'), '2028-02')).toEqual(['2028-02-29']);
  });

  it('C21 annual occurrences fall once a year and clamp 29 February', () => {
    const spec = every('annually', '2026-11-05');

    expect(occurrencesInMonth(spec, '2026-12')).toEqual([]);
    expect(occurrencesInMonth(spec, '2027-11')).toEqual(['2027-11-05']);

    const leap = every('annually', '2024-02-29');
    expect(occurrencesInMonth(leap, '2025-02')).toEqual(['2025-02-28']);
    expect(occurrencesInMonth(leap, '2026-02')).toEqual(['2026-02-28']);
    expect(occurrencesInMonth(leap, '2028-02')).toEqual(['2028-02-29']);
    expect(occurrencesInMonth(leap, '2025-03')).toEqual([]);
  });

  it('C22 an instalment part way through numbers its occurrences and stops at the total', () => {
    const spec = instalments('2026-11-15', 97, 504);

    expect(occurrencesInMonth(spec, '2026-11')).toEqual(['2026-11-15']);
    expect(instalmentNumber(spec, '2026-11-15')).toBe(97);
    expect(instalmentNumber(spec, '2026-12-15')).toBe(98);
    expect(occurrencesInMonth(spec, '2060-10')).toEqual(['2060-10-15']);
    expect(instalmentNumber(spec, '2060-10-15')).toBe(504);
    expect(occurrencesInMonth(spec, '2060-11')).toEqual([]);
    expect(occurrencesInMonth(spec, '2026-10')).toEqual([]);
  });

  it('C23 an instalment from number 1 ends at the total', () => {
    const spec = instalments('2026-11-15', 1, 10);

    expect(occurrencesInMonth(spec, '2027-08')).toEqual(['2027-08-15']);
    expect(instalmentNumber(spec, '2027-08-15')).toBe(10);
    expect(occurrencesInMonth(spec, '2027-09')).toEqual([]);
  });
});
