import { describe, expect, it } from 'vitest';
import { groupTitle, shiftMonth } from '../dates';
import { formatAmount } from '../money';

describe('formatAmount', () => {
  it('formats 1399.66 as 1,399.66 and 0.5 as 0.50', () => {
    expect(formatAmount('1399.66')).toBe('1,399.66');
    expect(formatAmount('0.5')).toBe('0.50');
    expect(formatAmount('-0.34')).toBe('-0.34');
  });
});

describe('groupTitle', () => {
  it('formats 2026-11-16 as 16/11/2026 - Monday', () => {
    expect(groupTitle('2026-11-16')).toBe('16/11/2026 - Monday');
  });
});

describe('shiftMonth', () => {
  it('rolls 2026-12 forward to 2027-01 and 2027-01 back to 2026-12', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
  });
});
