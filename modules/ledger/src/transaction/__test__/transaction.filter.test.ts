import { describe, expect, it } from 'vitest';
import type { Category } from '../../category/category.types.js';
import { NotFoundError } from '../../shared/errors.js';
import { TransactionService } from '../transaction.service.js';
import { InMemoryTransactionRepository } from './mocks/transaction.repository.mock.js';

// Unit: a category filter selects the category and its descendants (AC 32, AD-013); the
// descendants come from the category service, stubbed here with a fixed branch.
const ALICE = 'alice';
const BRANCH: Record<string, string[]> = {
  food: ['food', 'groceries', 'fruit'],
  groceries: ['groceries', 'fruit'],
};

function setup() {
  const asked: string[][] = [];
  const repository = new InMemoryTransactionRepository();
  const service = new TransactionService(
    repository,
    {
      getAccount: (id: string, userId: string) => ({
        id,
        userId,
        name: id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    {
      getCategory(id: string, userId: string): Category {
        if (!['food', 'groceries', 'fruit', 'home'].includes(id))
          throw new NotFoundError('Category not found');
        return {
          id,
          userId,
          parentId: null,
          name: id,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      descendantIds(_userId: string, ids: readonly string[]) {
        asked.push([...ids]);
        return [...new Set(ids.flatMap((id) => BRANCH[id] ?? [id]))];
      },
    }
  );
  for (const [description, categoryId, amount] of [
    ['Lunch', 'food', '1'],
    ['Market', 'groceries', '2'],
    ['Apples', 'fruit', '4'],
    ['Rent', 'home', '8'],
  ] as const) {
    service.createTransaction(ALICE, {
      date: '2026-11-05',
      description,
      categoryId,
      accountId: 'acc-1',
      amount,
      type: 'debit',
    });
  }
  // A transaction whose category was deleted (the database sets it to null).
  const loose = service.createTransaction(ALICE, {
    date: '2026-11-05',
    description: 'Loose',
    categoryId: 'home',
    accountId: 'acc-1',
    amount: '16',
    type: 'debit',
  });
  repository.revisions = repository.revisions.map((r) =>
    r.transactionId === loose.id ? { ...r, categoryId: null } : r
  );
  return { service, asked };
}

const names = (service: TransactionService, categoryIds: (string | null)[]) =>
  service
    .listMonth(ALICE, '2026-11', { categoryIds, accountIds: [] })
    .map((o) => o.description)
    .sort();

describe('TransactionService category filter', () => {
  it('AC32 listMonth selects the category and every descendant the category service returns', () => {
    const { service, asked } = setup();
    expect(names(service, ['food'])).toEqual(['Apples', 'Lunch', 'Market']);
    expect(names(service, ['groceries'])).toEqual(['Apples', 'Market']);
    expect(asked).toEqual([['food'], ['groceries']]);
  });

  it('AC32 balance counts the category and every descendant', () => {
    const { service } = setup();
    expect(service.balance(ALICE, '2026-11', { categoryIds: ['food'], accountIds: [] })).toEqual({
      days: [{ date: '2026-11-05', balance: '-7' }],
      totals: null,
    });
  });

  it('AC33 none stays selected beside expanded ids and alone asks for no descendants', () => {
    const { service, asked } = setup();
    expect(names(service, [null, 'groceries'])).toEqual(['Apples', 'Loose', 'Market']);
    expect(asked).toEqual([['groceries']]);
    expect(names(service, [null])).toEqual(['Loose']);
    expect(names(service, [])).toEqual(['Apples', 'Loose', 'Lunch', 'Market', 'Rent']);
    expect(asked).toEqual([['groceries']]);
  });
});
