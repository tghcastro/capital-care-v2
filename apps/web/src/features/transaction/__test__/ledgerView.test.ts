import type { Occurrence } from '@capital-care/shared';
import { describe, expect, it } from 'vitest';
import { groupByDay } from '../ledgerView';

function occ(over: Partial<Occurrence>): Occurrence {
  return {
    transactionId: 't',
    date: '2026-11-01',
    description: 'x',
    categoryId: 'c1',
    accountId: 'a1',
    type: 'debit',
    amount: '1',
    recurrence: null,
    instalment: null,
    status: 'forecast',
    ...over,
  };
}

describe('ledgerView', () => {
  it('orders groups ascending by date', () => {
    const groups = groupByDay(
      [occ({ date: '2026-11-20' }), occ({ date: '2026-11-03' }), occ({ date: '2026-11-11' })],
      []
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-11-03', '2026-11-11', '2026-11-20']);
  });

  it('keeps the API order inside a day and takes each day balance from the balance route', () => {
    const groups = groupByDay(
      [
        occ({ transactionId: 'a', date: '2026-11-01' }),
        occ({ transactionId: 'b', date: '2026-11-02' }),
        occ({ transactionId: 'c', date: '2026-11-01' }),
      ],
      [
        { date: '2026-11-01', balance: '8641' },
        { date: '2026-11-02', balance: '-0.34' },
      ]
    );
    expect(groups.map((g) => [g.date, g.items.map((i) => i.transactionId), g.balance])).toEqual([
      ['2026-11-01', ['a', 'c'], '8641'],
      ['2026-11-02', ['b'], '-0.34'],
    ]);
  });

  it('a day the balance route has not answered yet has no balance', () => {
    const groups = groupByDay([occ({ date: '2026-11-05' })], []);
    expect(groups[0]?.balance).toBeNull();
  });
});
