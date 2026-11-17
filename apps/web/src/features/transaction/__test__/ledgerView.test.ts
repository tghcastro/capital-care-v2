import type { Occurrence } from '@capital-care/shared';
import { describe, expect, it } from 'vitest';
import { buildLedger, NONE } from '../ledgerView';

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
const none = { categories: new Set<string>(), accounts: new Set<string>() };

describe('ledgerView', () => {
  it('orders groups ascending by date', () => {
    const { groups } = buildLedger(
      [occ({ date: '2026-11-20' }), occ({ date: '2026-11-03' }), occ({ date: '2026-11-11' })],
      none
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-11-03', '2026-11-11', '2026-11-20']);
  });

  it('running balance is 399.66 after day one and -0.34 after a later 400.00 debit', () => {
    const { groups } = buildLedger(
      [
        occ({ date: '2026-11-01', type: 'debit', amount: '100.35' }),
        occ({ date: '2026-11-01', type: 'receipt', amount: '500.01' }),
        occ({ date: '2026-11-02', type: 'debit', amount: '400.00' }),
      ],
      none
    );
    expect(groups.map((g) => g.balance)).toEqual(['399.66', '-0.34']);
  });

  it('sums 0.1 and 0.2 exactly', () => {
    const { totals } = buildLedger(
      [occ({ type: 'receipt', amount: '0.1' }), occ({ type: 'receipt', amount: '0.2' })],
      none
    );
    expect(totals.received).toBe('0.3');
  });

  it('totals are received, debits, net and final balance', () => {
    const { totals } = buildLedger(
      [
        occ({ date: '2026-11-01', type: 'receipt', amount: '500.01' }),
        occ({ date: '2026-11-02', type: 'debit', amount: '100.35' }),
      ],
      none
    );
    expect(totals).toEqual({
      received: '500.01',
      debits: '100.35',
      net: '399.66',
      finalBalance: '399.66',
    });
  });

  it('empty month has 0.00 totals', () => {
    const { groups, totals } = buildLedger([], none);
    expect(groups).toEqual([]);
    expect(totals).toEqual({ received: '0', debits: '0', net: '0', finalBalance: '0' });
  });

  it('filters limit the balance and totals to visible rows', () => {
    const rows = [
      occ({ date: '2026-11-01', type: 'receipt', amount: '1000', accountId: 'a1' }),
      occ({ date: '2026-11-02', type: 'debit', amount: '30', accountId: 'a2' }),
    ];
    const { groups, totals } = buildLedger(rows, {
      categories: new Set(),
      accounts: new Set(['a2']),
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.balance).toBe('-30');
    expect(totals).toEqual({ received: '0', debits: '30', net: '-30', finalBalance: '-30' });
  });

  it('category filter matches any selected id and Uncategorized matches null', () => {
    const rows = [
      occ({ description: 'one', categoryId: 'c1' }),
      occ({ description: 'two', categoryId: 'c2' }),
      occ({ description: 'three', categoryId: null }),
    ];
    const names = (cats: string[]) =>
      buildLedger(rows, { categories: new Set(cats), accounts: new Set() })
        .groups.flatMap((g) => g.items)
        .map((i) => i.description);
    expect(names(['c1', 'c2'])).toEqual(['one', 'two']);
    expect(names([NONE])).toEqual(['three']);
    expect(names(['c1', NONE])).toEqual(['one', 'three']);
    expect(names([])).toEqual(['one', 'two', 'three']);
  });

  it('account filter Unassigned matches null accountId', () => {
    const rows = [
      occ({ description: 'a', accountId: 'a1' }),
      occ({ description: 'b', accountId: null }),
    ];
    const items = buildLedger(rows, {
      categories: new Set(),
      accounts: new Set([NONE]),
    }).groups.flatMap((g) => g.items);
    expect(items.map((i) => i.description)).toEqual(['b']);
  });

  it('category and account filters combine with AND', () => {
    const rows = [
      occ({ description: 'both', categoryId: 'c1', accountId: 'a1' }),
      occ({ description: 'cat only', categoryId: 'c1', accountId: 'a2' }),
      occ({ description: 'acc only', categoryId: 'c2', accountId: 'a1' }),
    ];
    const items = buildLedger(rows, {
      categories: new Set(['c1']),
      accounts: new Set(['a1']),
    }).groups.flatMap((g) => g.items);
    expect(items.map((i) => i.description)).toEqual(['both']);
  });

  it('a category filter limits the balance and totals to visible rows', () => {
    const rows = [
      occ({ date: '2026-11-01', type: 'receipt', amount: '1000', categoryId: 'c1' }),
      occ({ date: '2026-11-02', type: 'debit', amount: '30', categoryId: 'c2' }),
    ];
    const { totals } = buildLedger(rows, { categories: new Set(['c2']), accounts: new Set() });
    expect(totals).toEqual({ received: '0', debits: '30', net: '-30', finalBalance: '-30' });
  });

  it('an account filter matches any of several selected accounts', () => {
    const rows = [
      occ({ description: 'a', accountId: 'a1' }),
      occ({ description: 'b', accountId: 'a2' }),
      occ({ description: 'c', accountId: 'a3' }),
    ];
    const items = buildLedger(rows, {
      categories: new Set(),
      accounts: new Set(['a1', 'a3']),
    }).groups.flatMap((g) => g.items);
    expect(items.map((i) => i.description)).toEqual(['a', 'c']);
  });
});
