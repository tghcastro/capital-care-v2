import { describe, expect, it } from 'vitest';
import type { Account } from '../../account/account.types.js';
import type { Category } from '../../category/category.types.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import type { CreateTransactionInput } from '../transaction.dto.js';
import { TransactionService } from '../transaction.service.js';
import { InMemoryTransactionRepository } from './mocks/transaction.repository.mock.js';

const ALICE = 'alice';
const BOB = 'bob';

// Who owns which category and account: the service only asks "is it mine?".
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

function create(
  service: Service,
  overrides: Partial<CreateTransactionInput> = {},
  userId: string = ALICE,
) {
  return service.createTransaction(userId, {
    date: '2026-11-05',
    description: 'Condo fees',
    categoryId: 'cat-1',
    accountId: 'acc-1',
    amount: '20',
    type: 'debit',
    ...overrides,
  });
}

/** [date, amount, status] of every occurrence of a month, in listed order. */
function view(service: Service, month: string, userId: string = ALICE) {
  return service.listMonth(userId, month).map((o) => [o.date, o.amount, o.status]);
}

describe('TransactionService', () => {
  it('C2 a new transaction is a forecast even with a past date', () => {
    const { service } = setup();
    create(service, { date: '2026-01-05' });

    expect(service.listMonth(ALICE, '2026-01').map((o) => o.status)).toEqual(['forecast']);
  });

  it('C7 category and account must exist and belong to the caller', () => {
    const { service, repository } = setup();

    expect(() => create(service, { categoryId: 'nope' })).toThrow(ValidationError);
    expect(() => create(service, { categoryId: 'nope' })).toThrow(/categoryId/);
    expect(() => create(service, { accountId: 'nope' })).toThrow(/accountId/);
    expect(() => create(service, { accountId: 'acc-bob' })).toThrow(/accountId/);
    expect(() => create(service, { categoryId: 'cat-bob' })).toThrow(/categoryId/);
    expect(repository.definitions.size).toBe(0);

    const { id } = create(service);
    expect(() => service.editOccurrence(ALICE, id, '2026-11-05', { accountId: 'acc-bob' })).toThrow(
      ValidationError,
    );
    expect(view(service, '2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
  });

  it('C10 a month lists its first to last day and nothing outside', () => {
    const { service } = setup();
    for (const date of ['2026-10-31', '2026-11-01', '2026-11-30', '2026-12-01']) {
      create(service, { date, description: `On ${date}` });
    }

    expect(service.listMonth(ALICE, '2026-11').map((o) => o.date)).toEqual(['2026-11-01', '2026-11-30']);
  });

  it('C11 an empty month returns an empty list', () => {
    const { service } = setup();
    create(service, { date: '2026-11-05' });

    expect(service.listMonth(ALICE, '2026-10')).toEqual([]);
  });

  it('C12 past forecasts are listed together with settled entries', () => {
    const { service } = setup();
    const salary = create(service, { date: '2026-11-01', description: 'Salary' });
    create(service, { date: '2026-11-03', description: 'Dentist' });
    service.settle(ALICE, salary.id, '2026-11-01', {});

    expect(view(service, '2026-11')).toEqual([
      ['2026-11-01', '20', 'settled'],
      ['2026-11-03', '20', 'forecast'],
    ]);
  });

  it('C13 month occurrences are ordered by date then description ignoring case', () => {
    const { service } = setup();
    create(service, { date: '2026-11-05', description: 'Gym' });
    create(service, { date: '2026-11-05', description: 'condo' });
    create(service, { date: '2026-11-02', description: 'Zed' });

    expect(service.listMonth(ALICE, '2026-11').map((o) => o.description)).toEqual(['Zed', 'condo', 'Gym']);
  });

  it('C15 an occurrence carries all fields with the values in force on its date', () => {
    const { service } = setup();
    const created = create(service, { recurrence: 'monthly' });
    service.editOccurrence(ALICE, created.id, '2026-12-05', { amount: '25', description: 'Condo' });

    const [nov] = service.listMonth(ALICE, '2026-11');
    const [jan] = service.listMonth(ALICE, '2027-01');

    expect(nov).toEqual({
      transactionId: created.id,
      date: '2026-11-05',
      description: 'Condo fees',
      categoryId: 'cat-1',
      accountId: 'acc-1',
      type: 'debit',
      amount: '20',
      recurrence: 'monthly',
      instalment: null,
      status: 'forecast',
    });
    expect(nov?.recurrence).toBe('monthly');
    expect(jan).toMatchObject({ date: '2027-01-05', amount: '25', description: 'Condo' });
  });

  it('C25 occurrences in different months share the transaction id', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });

    const ids = ['2026-11', '2026-12', '2027-06'].flatMap((month) =>
      service.listMonth(ALICE, month).map((o) => o.transactionId),
    );

    expect(ids).toEqual([id, id, id]);
  });

  it('C26 settling a forecast occurrence marks it settled and keeps its amount', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });

    const settled = service.settle(ALICE, id, '2026-11-05', {});

    expect(settled).toMatchObject({ status: 'settled', amount: '20', date: '2026-11-05' });
    expect(view(service, '2026-11')).toEqual([['2026-11-05', '20', 'settled']]);
    expect(view(service, '2026-12')).toEqual([['2026-12-05', '20', 'forecast']]);
  });

  it('C27 a real paid amount applies to that occurrence only', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });

    service.settle(ALICE, id, '2026-12-05', { amount: '22' });

    expect(view(service, '2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
    expect(view(service, '2026-12')).toEqual([['2026-12-05', '22', 'settled']]);
    expect(view(service, '2027-01')).toEqual([['2027-01-05', '20', 'forecast']]);
  });

  it('C28 settling twice returns 409 and changes nothing', () => {
    const { service, repository } = setup();
    const { id } = create(service);
    service.settle(ALICE, id, '2026-11-05', { amount: '22' });

    expect(() => service.settle(ALICE, id, '2026-11-05', { amount: '30' })).toThrow(ConflictError);
    expect(repository.settlements).toHaveLength(1);
    expect(view(service, '2026-11')).toEqual([['2026-11-05', '22', 'settled']]);
  });

  it('C29 undoing a settlement restores the forecast and a forecast cannot be undone', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });
    service.settle(ALICE, id, '2026-12-05', { amount: '22' });

    const undone = service.unsettle(ALICE, id, '2026-12-05');

    expect(undone).toMatchObject({ status: 'forecast', amount: '20' });
    expect(view(service, '2026-12')).toEqual([['2026-12-05', '20', 'forecast']]);
    expect(() => service.unsettle(ALICE, id, '2026-12-05')).toThrow(ConflictError);
  });

  it('C30 nothing is settled automatically', () => {
    const { service } = setup();
    create(service, { date: '2026-01-15', description: 'Car loan', instalment: { number: 8, total: 48 } });
    create(service, { date: '2025-03-10', description: 'Last year' });

    expect(service.listMonth(ALICE, '2026-11').map((o) => o.status)).toEqual(['forecast']);
    expect(service.listMonth(ALICE, '2025-03').map((o) => o.status)).toEqual(['forecast']);
  });

  it('C32 a forecast edit applies from that occurrence onward', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });

    service.editOccurrence(ALICE, id, '2026-12-05', { amount: '25' });

    expect(view(service, '2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
    expect(view(service, '2026-12')).toEqual([['2026-12-05', '25', 'forecast']]);
    expect(view(service, '2027-01')).toEqual([['2027-01-05', '25', 'forecast']]);
  });

  it('C33 an edit does not change later settled occurrences', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });
    service.settle(ALICE, id, '2027-01-05', {});

    service.editOccurrence(ALICE, id, '2026-12-05', { amount: '25' });

    expect(view(service, '2027-01')).toEqual([['2027-01-05', '20', 'settled']]);
    expect(view(service, '2027-02')).toEqual([['2027-02-05', '25', 'forecast']]);
  });

  it('C34 editing a settled occurrence changes only it', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });
    service.settle(ALICE, id, '2026-11-05', {});

    service.editOccurrence(ALICE, id, '2026-11-05', { amount: '21' });

    expect(view(service, '2026-11')).toEqual([['2026-11-05', '21', 'settled']]);
    expect(view(service, '2026-12')).toEqual([['2026-12-05', '20', 'forecast']]);
  });

  it('C35 an earlier edit replaces a later planned edit', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });
    service.editOccurrence(ALICE, id, '2027-01-05', { amount: '30', description: 'Later plan' });

    service.editOccurrence(ALICE, id, '2026-12-05', { amount: '25' });

    const [jan] = service.listMonth(ALICE, '2027-01');
    expect(jan).toMatchObject({ amount: '25', description: 'Condo fees', status: 'forecast' });
  });

  it('C36 editing the first occurrence changes the whole series', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });

    service.editOccurrence(ALICE, id, '2026-11-05', { amount: '18', categoryId: 'cat-2', type: 'receipt' });

    for (const month of ['2026-11', '2026-12', '2028-03']) {
      expect(service.listMonth(ALICE, month)[0]).toMatchObject({
        amount: '18',
        categoryId: 'cat-2',
        type: 'receipt',
      });
    }
  });

  it('C37 editing a one-off changes the entry', () => {
    const { service } = setup();
    const { id } = create(service, { date: '2026-11-10', description: 'New office chair', amount: '229' });

    const edited = service.editOccurrence(ALICE, id, '2026-11-10', { amount: '199', accountId: 'acc-2' });

    expect(edited).toMatchObject({ amount: '199', accountId: 'acc-2', description: 'New office chair' });
    expect(view(service, '2026-11')).toEqual([['2026-11-10', '199', 'forecast']]);
  });

  it('C39 an edit keeps instalment numbering', () => {
    const { service } = setup();
    const { id } = create(service, {
      date: '2026-11-15',
      description: 'Car loan',
      instalment: { number: 97, total: 504 },
    });

    service.editOccurrence(ALICE, id, '2026-12-15', { amount: '120' });

    expect(service.listMonth(ALICE, '2026-11')[0]?.instalment).toEqual({ number: 97, total: 504 });
    expect(service.listMonth(ALICE, '2027-01')[0]).toMatchObject({
      instalment: { number: 99, total: 504 },
      amount: '120',
      recurrence: null,
    });
  });

  it('C40 stopping removes the occurrence and all later ones and keeps earlier ones', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });
    service.settle(ALICE, id, '2026-11-05', {});
    service.settle(ALICE, id, '2027-02-05', {});

    service.stopFrom(ALICE, id, '2027-01-05');

    expect(view(service, '2026-11')).toEqual([['2026-11-05', '20', 'settled']]);
    expect(view(service, '2026-12')).toEqual([['2026-12-05', '20', 'forecast']]);
    expect(view(service, '2027-01')).toEqual([]);
    expect(view(service, '2027-02')).toEqual([]);
    expect(view(service, '2030-01')).toEqual([]);
  });

  it('C41 stopping from the first occurrence removes the transaction', () => {
    const { service, repository } = setup();
    const monthly = create(service, { recurrence: 'monthly' });
    const oneOff = create(service, { date: '2026-11-10', description: 'New office chair' });

    service.stopFrom(ALICE, monthly.id, '2026-11-05');
    service.stopFrom(ALICE, oneOff.id, '2026-11-10');

    expect(repository.definitions.size).toBe(0);
    expect(view(service, '2026-11')).toEqual([]);
  });

  it('C42 a removed occurrence is gone', () => {
    const { service } = setup();
    const { id } = create(service, { recurrence: 'monthly' });
    service.stopFrom(ALICE, id, '2027-01-05');

    expect(() => service.editOccurrence(ALICE, id, '2027-01-05', { amount: '1' })).toThrow(NotFoundError);
    expect(() => service.settle(ALICE, id, '2027-02-05', {})).toThrow(NotFoundError);
    expect(() => service.stopFrom(ALICE, id, '2027-03-05')).toThrow(NotFoundError);
    expect(view(service, '2027-01')).toEqual([]);
  });

  it('C43 stopping an instalment removes it from the chosen occurrence', () => {
    const { service } = setup();
    const { id } = create(service, {
      date: '2026-11-15',
      description: 'Car loan',
      instalment: { number: 17, total: 48 },
    });

    service.stopFrom(ALICE, id, '2027-03-15');

    expect(service.listMonth(ALICE, '2027-02')[0]?.instalment).toEqual({ number: 20, total: 48 });
    expect(service.listMonth(ALICE, '2027-03')).toEqual([]);
  });

  it('C44 a past occurrence can be deleted', () => {
    const { service } = setup();
    const oneOff = create(service, { date: '2026-10-05', description: 'Entered by mistake' });
    const monthly = create(service, { date: '2026-01-05', recurrence: 'monthly' });

    service.stopFrom(ALICE, oneOff.id, '2026-10-05');
    service.stopFrom(ALICE, monthly.id, '2026-03-05');

    expect(view(service, '2026-10')).toEqual([]);
    expect(view(service, '2026-02')).toEqual([['2026-02-05', '20', 'forecast']]);
    expect(view(service, '2026-03')).toEqual([]);
  });

  it('C51 the month lists only the caller transactions', () => {
    const { service } = setup();
    create(service, { description: 'Gym' });
    create(service, { description: 'Rent', categoryId: 'cat-bob', accountId: 'acc-bob' }, BOB);

    expect(service.listMonth(ALICE, '2026-11').map((o) => o.description)).toEqual(['Gym']);
    expect(service.listMonth(BOB, '2026-11').map((o) => o.description)).toEqual(['Rent']);
  });
});
