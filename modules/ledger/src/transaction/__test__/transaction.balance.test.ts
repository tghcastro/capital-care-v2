import { describe, expect, it } from 'vitest';
import type { Account } from '../../account/account.types.js';
import type { Category } from '../../category/category.types.js';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import type { CreateTransactionInput } from '../transaction.dto.js';
import { TransactionService, type MonthFilters } from '../transaction.service.js';
import { InMemoryTransactionRepository } from './mocks/transaction.repository.mock.js';

// Unit: the monthly balance, the API-side filters and moving an occurrence's date.
const ALICE = 'alice';
const BOB = 'bob';

const categoryOwners: Record<string, string> = { 'cat-1': ALICE, 'cat-2': ALICE, 'cat-bob': BOB };
const accountOwners: Record<string, string> = { 'acc-1': ALICE, 'acc-2': ALICE, 'acc-bob': BOB };

function setup() {
  const repository = new InMemoryTransactionRepository();
  const service = new TransactionService(
    repository,
    {
      getAccount(id: string, userId: string): Account {
        if (accountOwners[id] !== userId) throw new NotFoundError('Account not found');
        return { id, userId, name: id, createdAt: new Date(), updatedAt: new Date() };
      },
    },
    {
      getCategory(id: string, userId: string): Category {
        if (categoryOwners[id] !== userId) throw new NotFoundError('Category not found');
        return { id, userId, name: id, description: null, createdAt: new Date(), updatedAt: new Date() };
      },
    },
  );
  return { repository, service };
}

type Service = ReturnType<typeof setup>['service'];

function create(service: Service, overrides: Partial<CreateTransactionInput> = {}, userId = ALICE) {
  return service.createTransaction(userId, {
    date: '2026-11-05',
    description: 'Entry',
    categoryId: 'cat-1',
    accountId: 'acc-1',
    amount: '20',
    type: 'debit',
    ...overrides,
  });
}

const NO_FILTER: MonthFilters = { categoryIds: [], accountIds: [] };

function finalBalance(service: Service, month: string, filters: MonthFilters = NO_FILTER, userId = ALICE) {
  return service.balance(userId, month, filters).totals?.finalBalance;
}

/** [date, transactionId, amount, status, instalment] of every occurrence of a month. */
function occurrences(service: Service, month: string) {
  return service.listMonth(ALICE, month, NO_FILTER).map((o) => ({
    date: o.date,
    transactionId: o.transactionId,
    amount: o.amount,
    status: o.status,
    instalment: o.instalment ? `${o.instalment.number}/${o.instalment.total}` : null,
  }));
}

describe('TransactionService balance', () => {
  it('MB2 settled and forecast occurrences both count', () => {
    const { service } = setup();
    const salary = create(service, { date: '2026-10-01', type: 'receipt', amount: '1000' });
    create(service, { date: '2026-10-10', type: 'debit', amount: '300' });
    service.settle(ALICE, salary.id, '2026-10-01', {});

    expect(finalBalance(service, '2026-11')).toBe('700');
    expect(service.balance(ALICE, '2026-11', NO_FILTER).totals?.net).toBe('0');
  });

  it('MB2 a monthly receipt of 100.00 from 2026-01-15 opens April 2026 at 300.00', () => {
    const { service } = setup();
    create(service, { date: '2026-01-15', type: 'receipt', amount: '100', recurrence: 'monthly' });

    // April has its own 100.00 on the 15th: the day starts from the 300.00 opening balance.
    const april = service.balance(ALICE, '2026-04', NO_FILTER);
    expect(april.days).toEqual([{ date: '2026-04-15', balance: '400' }]);
    expect(april.totals).toEqual({ received: '100', debits: '0', net: '100', finalBalance: '400' });
  });

  it('MB2 the same receipt stopped from 2026-03-15 opens April 2026 at 200.00', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2026-01-15', type: 'receipt', amount: '100', recurrence: 'monthly' });
    service.stopFrom(ALICE, id, '2026-03-15');

    const april = service.balance(ALICE, '2026-04', NO_FILTER);
    expect(april.days).toEqual([]);
    expect(april.totals).toEqual({ received: '0', debits: '0', net: '0', finalBalance: '200' });
  });

  it("MB2 another user's transactions never count", () => {
    const { service } = setup();
    create(service, { date: '2026-10-01', type: 'receipt', amount: '500' });
    create(service, { date: '2026-10-01', type: 'receipt', amount: '9000', categoryId: 'cat-bob', accountId: 'acc-bob' }, BOB);
    create(service, { date: '2026-11-02', type: 'receipt', amount: '9000', categoryId: 'cat-bob', accountId: 'acc-bob' }, BOB);

    expect(finalBalance(service, '2026-11')).toBe('500');
    expect(service.balance(ALICE, '2026-11', NO_FILTER).days).toEqual([]);
    expect(finalBalance(service, '2026-11', NO_FILTER, BOB)).toBe('18000');
  });

  it('MB8 account none counts only occurrences with no account, opening balance included', () => {
    const { service, repository } = setup();
    const before = create(service, { date: '2026-10-01', type: 'receipt', amount: '40' });
    const during = create(service, { date: '2026-11-03', type: 'debit', amount: '15' });
    create(service, { date: '2026-10-01', type: 'receipt', amount: '1000', accountId: 'acc-2' });
    create(service, { date: '2026-11-03', type: 'debit', amount: '7', accountId: 'acc-2' });
    // A deleted account leaves its occurrences with no account.
    for (const revision of repository.revisions) {
      if (revision.transactionId === before.id || revision.transactionId === during.id) revision.accountId = null;
    }

    const none = service.balance(ALICE, '2026-11', { categoryIds: [], accountIds: [null] });
    expect(none.days).toEqual([{ date: '2026-11-03', balance: '25' }]);
    expect(none.totals).toEqual({ received: '0', debits: '15', net: '-15', finalBalance: '25' });
    expect(service.listMonth(ALICE, '2026-11', { categoryIds: [], accountIds: [null] }).map((o) => o.amount)).toEqual(['15']);
  });

  it('MB13 listMonth matches any selected id within a param and both params together', () => {
    const { service } = setup();
    create(service, { date: '2026-11-01', description: 'A', categoryId: 'cat-1', accountId: 'acc-1' });
    create(service, { date: '2026-11-02', description: 'B', categoryId: 'cat-2', accountId: 'acc-1' });
    create(service, { date: '2026-11-03', description: 'C', categoryId: 'cat-1', accountId: 'acc-2' });
    create(service, { date: '2026-11-04', description: 'D', categoryId: 'cat-2', accountId: 'acc-2' });
    const names = (filters: MonthFilters) => service.listMonth(ALICE, '2026-11', filters).map((o) => o.description);

    expect(names(NO_FILTER)).toEqual(['A', 'B', 'C', 'D']);
    expect(names({ categoryIds: ['cat-1'], accountIds: [] })).toEqual(['A', 'C']);
    expect(names({ categoryIds: ['cat-1', 'cat-2'], accountIds: [] })).toEqual(['A', 'B', 'C', 'D']);
    expect(names({ categoryIds: [], accountIds: ['acc-2'] })).toEqual(['C', 'D']);
    expect(names({ categoryIds: ['cat-2'], accountIds: ['acc-2'] })).toEqual(['D']);
    expect(names({ categoryIds: ['cat-1', 'cat-2'], accountIds: ['acc-1'] })).toEqual(['A', 'B']);
  });

  it("MB13 category none and account none match null references and another user's ids match nothing", () => {
    const { service, repository } = setup();
    const loose = create(service, { date: '2026-11-01', description: 'Loose' });
    create(service, { date: '2026-11-02', description: 'Kept' });
    create(service, { date: '2026-11-03', description: 'Bob', categoryId: 'cat-bob', accountId: 'acc-bob' }, BOB);
    for (const revision of repository.revisions) {
      if (revision.transactionId === loose.id) {
        revision.categoryId = null;
        revision.accountId = null;
      }
    }
    const names = (filters: MonthFilters) => service.listMonth(ALICE, '2026-11', filters).map((o) => o.description);

    expect(names({ categoryIds: [null], accountIds: [] })).toEqual(['Loose']);
    expect(names({ categoryIds: [], accountIds: [null] })).toEqual(['Loose']);
    expect(names({ categoryIds: [null, 'cat-1'], accountIds: [] })).toEqual(['Loose', 'Kept']);
    expect(names({ categoryIds: ['cat-bob'], accountIds: [] })).toEqual([]);
    expect(names({ categoryIds: [], accountIds: ['acc-bob'] })).toEqual([]);
    expect(service.balance(ALICE, '2026-11', { categoryIds: [], accountIds: ['acc-bob'] }).totals).toEqual({
      received: '0',
      debits: '0',
      net: '0',
      finalBalance: '0',
    });
  });
});

describe('TransactionService move', () => {
  it('MB16 moving a one-off keeps its id values and settlement', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2026-12-15', description: 'Condo fees', amount: '450' });
    service.settle(ALICE, id, '2026-12-15', { amount: '455' });

    const moved = service.editOccurrence(ALICE, id, '2026-12-15', { date: '2027-01-02' });

    expect(moved).toMatchObject({
      transactionId: id,
      date: '2027-01-02',
      description: 'Condo fees',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      type: 'debit',
      amount: '455',
      status: 'settled',
      recurrence: null,
    });
    expect(occurrences(service, '2026-12')).toEqual([]);
    expect(occurrences(service, '2027-01')).toEqual([
      { date: '2027-01-02', transactionId: id, amount: '455', status: 'settled', instalment: null },
    ]);
  });

  it('MB18 moving a monthly occurrence shifts it and every later one', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2027-01-10', amount: '100', recurrence: 'monthly' });
    service.settle(ALICE, id, '2027-01-10', {});

    const moved = service.editOccurrence(ALICE, id, '2027-03-10', { date: '2027-03-20' });

    expect(moved.transactionId).not.toBe(id);
    expect(moved).toMatchObject({ date: '2027-03-20', amount: '100', recurrence: 'monthly', status: 'forecast' });
    expect(occurrences(service, '2027-01')).toEqual([
      { date: '2027-01-10', transactionId: id, amount: '100', status: 'settled', instalment: null },
    ]);
    expect(occurrences(service, '2027-02')).toEqual([
      { date: '2027-02-10', transactionId: id, amount: '100', status: 'forecast', instalment: null },
    ]);
    expect(occurrences(service, '2027-03')).toEqual([
      { date: '2027-03-20', transactionId: moved.transactionId, amount: '100', status: 'forecast', instalment: null },
    ]);
    expect(occurrences(service, '2027-04')).toEqual([
      { date: '2027-04-20', transactionId: moved.transactionId, amount: '100', status: 'forecast', instalment: null },
    ]);
  });

  it('MB18 the shifted series carries the values in force on the old date', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2027-01-10', amount: '100', recurrence: 'monthly' });
    service.editOccurrence(ALICE, id, '2027-02-10', { amount: '120', description: 'Raised' });

    const moved = service.editOccurrence(ALICE, id, '2027-03-10', { date: '2027-03-20' });

    expect(moved).toMatchObject({ amount: '120', description: 'Raised' });
    expect(service.listMonth(ALICE, '2027-05', NO_FILTER).map((o) => [o.date, o.amount])).toEqual([['2027-05-20', '120']]);
  });

  it('MB19 moving an instalment keeps the numbering and the total', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2027-01-10', amount: '50', instalment: { number: 3, total: 6 } });

    const moved = service.editOccurrence(ALICE, id, '2027-02-10', { date: '2027-02-25' });

    expect(moved.instalment).toEqual({ number: 4, total: 6 });
    const plan = ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05'].flatMap((month) =>
      occurrences(service, month).map((o) => [o.date, o.instalment]),
    );
    expect(plan).toEqual([
      ['2027-01-10', '3/6'],
      ['2027-02-25', '4/6'],
      ['2027-03-25', '5/6'],
      ['2027-04-25', '6/6'],
    ]);
  });

  it('MB20 moving the first occurrence moves the whole series', () => {
    const { service, repository } = setup();
    const { id } = create(service, { date: '2027-01-10', amount: '100', recurrence: 'monthly' });

    const moved = service.editOccurrence(ALICE, id, '2027-01-10', { date: '2027-01-03' });

    const dates = ['2026-12', '2027-01', '2027-02'].flatMap((month) => occurrences(service, month).map((o) => o.date));
    expect(dates).toEqual(['2027-01-03', '2027-02-03']);
    expect(moved.date).toBe('2027-01-03');
    // Nothing of the old series is left to list.
    expect(service.listMonth(ALICE, '2027-03', NO_FILTER).every((o) => o.transactionId === moved.transactionId)).toBe(true);
    expect(repository.definitions.size).toBeGreaterThan(0);
  });

  it('MB21 moving a settled occurrence of a series is refused and changes nothing', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2027-01-10', amount: '100', recurrence: 'monthly' });
    service.settle(ALICE, id, '2027-02-10', {});
    const before = ['2027-01', '2027-02', '2027-03'].map((month) => occurrences(service, month));

    expect(() => service.editOccurrence(ALICE, id, '2027-02-10', { date: '2027-02-20' })).toThrow(ConflictError);
    expect(() => service.editOccurrence(ALICE, id, '2027-02-10', { date: '2027-02-20' })).toThrow(/settled/);
    expect(['2027-01', '2027-02', '2027-03'].map((month) => occurrences(service, month))).toEqual(before);
  });

  it('MB21 moving an occurrence with a later settled one is refused and changes nothing', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2027-01-10', amount: '100', recurrence: 'monthly' });
    service.settle(ALICE, id, '2027-04-10', {});
    const before = ['2027-02', '2027-03', '2027-04'].map((month) => occurrences(service, month));

    expect(() => service.editOccurrence(ALICE, id, '2027-02-10', { date: '2027-02-20' })).toThrow(ConflictError);
    expect(() => service.editOccurrence(ALICE, id, '2027-02-10', { date: '2027-02-20' })).toThrow(/settled/);
    expect(['2027-02', '2027-03', '2027-04'].map((month) => occurrences(service, month))).toEqual(before);
  });

  it('MB22 a date equal to the current one moves nothing', () => {
    const { service } = setup();
    const oneOff = create(service, { date: '2027-01-10', amount: '30' });
    const series = create(service, { date: '2027-01-12', amount: '100', recurrence: 'monthly' });

    expect(service.editOccurrence(ALICE, oneOff.id, '2027-01-10', { date: '2027-01-10' })).toMatchObject({
      transactionId: oneOff.id,
      date: '2027-01-10',
    });
    expect(service.editOccurrence(ALICE, series.id, '2027-02-12', { date: '2027-02-12' })).toMatchObject({
      transactionId: series.id,
      date: '2027-02-12',
    });
    expect(occurrences(service, '2027-03').map((o) => [o.date, o.transactionId])).toEqual([['2027-03-12', series.id]]);
  });
});
