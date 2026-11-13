import { describe, expect, it } from 'vitest';
import {
  amountSchema,
  createTransactionSchema,
  descriptionSchema,
  instalmentSchema,
  monthSchema,
  transactionTypeSchema,
} from '../transaction.dto.js';

const valid = {
  date: '2026-11-10',
  description: 'New office chair',
  categoryId: 'cat-1',
  accountId: 'acc-1',
  amount: '229',
  type: 'debit',
};

describe('transaction schemas', () => {
  it('C3 type rule accepts receipt and debit only', () => {
    expect(transactionTypeSchema.safeParse('receipt').success).toBe(true);
    expect(transactionTypeSchema.safeParse('debit').success).toBe(true);
    for (const bad of ['Debit', 'expense', undefined]) {
      expect(transactionTypeSchema.safeParse(bad).success).toBe(false);
    }
    expect(createTransactionSchema.safeParse({ ...valid, type: undefined }).success).toBe(false);
  });

  it('C4 amount rule accepts positive decimals within the bounds only', () => {
    for (const bad of ['0', '-5', '1,5', 'abc', 229, '12.12345', '1234567890123', '0.0000']) {
      expect(amountSchema.safeParse(bad).success, `${String(bad)} must be rejected`).toBe(false);
    }
    expect(amountSchema.parse('12.1234')).toBe('12.1234');
    expect(amountSchema.parse('123456789012')).toBe('123456789012');
    expect(amountSchema.parse('1000.00')).toBe('1000');
    expect(amountSchema.parse('0.5')).toBe('0.5');
  });

  it('C5 description is trimmed and limited to 1 to 100 characters', () => {
    for (const bad of ['', '   ', 'x'.repeat(101)]) {
      expect(descriptionSchema.safeParse(bad).success).toBe(false);
    }
    expect(descriptionSchema.safeParse('x'.repeat(100)).success).toBe(true);
    expect(descriptionSchema.parse('  Gym  ')).toBe('Gym');
    expect(descriptionSchema.safeParse(undefined).success).toBe(false);
  });

  it('C6 date rule accepts real YYYY-MM-DD dates only', () => {
    for (const bad of ['2026-02-30', '2026-1-5', '05/11/2026', '', undefined]) {
      expect(createTransactionSchema.safeParse({ ...valid, date: bad }).success).toBe(false);
    }
    expect(createTransactionSchema.safeParse({ ...valid, date: '2028-02-29' }).success).toBe(true);
    expect(createTransactionSchema.safeParse({ ...valid, date: '2027-02-29' }).success).toBe(false);
  });

  it('C8 recurrence and instalment are exclusive and recurrence is one of four values', () => {
    const instalment = { number: 1, total: 10 };
    expect(
      createTransactionSchema.safeParse({ ...valid, recurrence: 'monthly', instalment }).success,
    ).toBe(false);
    for (const recurrence of ['daily', 'weekly', 'monthly', 'annually']) {
      expect(createTransactionSchema.safeParse({ ...valid, recurrence }).success).toBe(true);
    }
    for (const bad of ['yearly', 'Monthly', '', 3]) {
      expect(createTransactionSchema.safeParse({ ...valid, recurrence: bad }).success).toBe(false);
    }
    expect(createTransactionSchema.safeParse({ ...valid, instalment }).success).toBe(true);
  });

  it('C14 month rule accepts YYYY-MM only', () => {
    expect(monthSchema.safeParse('2026-11').success).toBe(true);
    expect(monthSchema.safeParse('2026-12').success).toBe(true);
    for (const bad of [undefined, '2026-13', '2026-1', '2026-11-05', '2026-00', '']) {
      expect(monthSchema.safeParse(bad).success, `${String(bad)} must be rejected`).toBe(false);
    }
  });

  it('C24 instalment rule accepts whole numbers with number within total and total up to 999', () => {
    const ok = (number: number, total: number) => instalmentSchema.safeParse({ number, total }).success;

    expect(ok(1, 999)).toBe(true);
    expect(ok(97, 504)).toBe(true);
    expect(ok(10, 10)).toBe(true);
    expect(ok(0, 10)).toBe(false);
    expect(ok(11, 10)).toBe(false);
    expect(ok(1, 1000)).toBe(false);
    expect(ok(1.5, 10)).toBe(false);
    expect(ok(1, 0)).toBe(false);
  });

  it('C61 amount digit limit counts the integer part without leading zeros', () => {
    expect(amountSchema.parse('000000000005')).toBe('5');
    expect(amountSchema.parse('0000000000005')).toBe('5');
    expect(amountSchema.parse('0000000000005.5')).toBe('5.5');
    expect(amountSchema.safeParse('1234567890123').success).toBe(false);
    expect(amountSchema.safeParse('00000000000000').success).toBe(false);
    expect(amountSchema.parse('123456789012')).toBe('123456789012');
  });
});
