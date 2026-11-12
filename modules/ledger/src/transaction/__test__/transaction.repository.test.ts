import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TransactionRepository } from '../transaction.repository.js';
import type { TransactionValues } from '../transaction.types.js';

// Real SQLite repository: keys, foreign keys and atomicity only exist in the database.
const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../shared/persistence/migrations',
);

let sqlite: Database.Database;
let repository: TransactionRepository;

beforeEach(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  repository = new TransactionRepository(db);
});

afterEach(() => {
  sqlite.close();
});

const values = (overrides: Partial<TransactionValues> = {}): TransactionValues => ({
  description: 'Condo fees',
  categoryId: null,
  accountId: null,
  type: 'debit',
  amount: '20',
  ...overrides,
});

const newMonthly = (v: TransactionValues = values()) =>
  repository.create({
    userId: 'alice',
    startDate: '2026-11-05',
    recurrence: 'monthly',
    instalment: null,
    values: v,
  });

function count(table: string): number {
  return (sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n;
}

function seedCategoryAndAccount(): void {
  sqlite
    .prepare(
      `INSERT INTO category (id, userId, name, description, createdAt, updatedAt) VALUES ('cat-1', 'alice', 'Housing', NULL, 0, 0)`,
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO account (id, userId, name, nameKey, createdAt, updatedAt) VALUES ('acc-1', 'alice', 'Checking', 'checking', 0, 0)`,
    )
    .run();
}

describe('TransactionRepository (real SQLite)', () => {
  it('C52 the migrations create the three tables with their keys and cascade', () => {
    const primaryKey = (table: string) =>
      (sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string; pk: number }[])
        .filter((column) => column.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => column.name);

    expect(primaryKey('transaction')).toEqual(['id']);
    expect(primaryKey('transaction_revision')).toEqual(['transactionId', 'effectiveFrom']);
    expect(primaryKey('transaction_settlement')).toEqual(['transactionId', 'occurrenceDate']);

    const { definition } = newMonthly();
    repository.insertSettlement({ transactionId: definition.id, occurrenceDate: '2026-11-05', ...values() });
    expect(() =>
      repository.insertSettlement({ transactionId: definition.id, occurrenceDate: '2026-11-05', ...values() }),
    ).toThrow();

    repository.deleteTransaction(definition.id);

    expect(count('transaction')).toBe(0);
    expect(count('transaction_revision')).toBe(0);
    expect(count('transaction_settlement')).toBe(0);
  });

  it('C53 calendar dates are stored as YYYY-MM-DD text', () => {
    const { definition } = newMonthly();
    repository.replaceRevisionsFrom(definition.id, '2026-12-05', values({ amount: '25' }));
    repository.insertSettlement({ transactionId: definition.id, occurrenceDate: '2026-11-05', ...values() });
    repository.stopFrom(definition.id, '2027-03-05');

    const read = (sql: string) => sqlite.prepare(sql).all();

    expect(read(`SELECT typeof(startDate) AS t, startDate AS v, typeof(stopDate) AS st, stopDate AS sv FROM "transaction"`)).toEqual([
      { t: 'text', v: '2026-11-05', st: 'text', sv: '2027-03-05' },
    ]);
    expect(read(`SELECT typeof(effectiveFrom) AS t, effectiveFrom AS v FROM transaction_revision ORDER BY effectiveFrom`)).toEqual([
      { t: 'text', v: '2026-11-05' },
      { t: 'text', v: '2026-12-05' },
    ]);
    expect(read(`SELECT typeof(occurrenceDate) AS t, occurrenceDate AS v FROM transaction_settlement`)).toEqual([
      { t: 'text', v: '2026-11-05' },
    ]);
  });

  it('C54 deleting a category or account nulls the references in the database', () => {
    seedCategoryAndAccount();
    const { definition } = newMonthly(values({ categoryId: 'cat-1', accountId: 'acc-1' }));
    repository.insertSettlement({
      transactionId: definition.id,
      occurrenceDate: '2026-11-05',
      ...values({ categoryId: 'cat-1', accountId: 'acc-1' }),
    });

    sqlite.prepare(`DELETE FROM category WHERE id = 'cat-1'`).run();

    expect(count('transaction_revision')).toBe(1);
    expect(count('transaction_settlement')).toBe(1);
    let bundle = repository.getBundle(definition.id);
    expect(bundle?.revisions[0]).toMatchObject({ categoryId: null, accountId: 'acc-1' });
    expect(bundle?.settlements[0]).toMatchObject({ categoryId: null, accountId: 'acc-1' });

    sqlite.prepare(`DELETE FROM account WHERE id = 'acc-1'`).run();

    bundle = repository.getBundle(definition.id);
    expect(bundle?.revisions[0]).toMatchObject({ categoryId: null, accountId: null });
    expect(bundle?.settlements[0]).toMatchObject({ categoryId: null, accountId: null });
    expect(count('transaction')).toBe(1);
  });

  it('C56 a multi-row write rolls back as a whole', () => {
    // create: the second insert (revision) fails on an unknown category, so no definition remains.
    expect(() =>
      repository.create({
        userId: 'alice',
        startDate: '2026-11-05',
        recurrence: null,
        instalment: null,
        values: values({ categoryId: 'missing' }),
      }),
    ).toThrow();
    expect(count('transaction')).toBe(0);
    expect(count('transaction_revision')).toBe(0);

    // edit and stop: a failure in their last statement leaves the earlier ones undone.
    const { definition } = newMonthly();
    repository.insertSettlement({ transactionId: definition.id, occurrenceDate: '2027-01-05', ...values() });
    repository.replaceRevisionsFrom(definition.id, '2026-12-05', values({ amount: '25' }));
    sqlite.exec(
      `CREATE TRIGGER fail_update BEFORE UPDATE ON "transaction" BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
    );

    expect(() => repository.replaceRevisionsFrom(definition.id, '2026-11-05', values({ amount: '1' }))).toThrow(/boom/);
    expect(() => repository.stopFrom(definition.id, '2026-12-05')).toThrow(/boom/);

    const bundle = repository.getBundle(definition.id);
    expect(bundle?.revisions.map((r) => [r.effectiveFrom, r.amount])).toEqual([
      ['2026-11-05', '20'],
      ['2026-12-05', '25'],
    ]);
    expect(bundle?.settlements).toHaveLength(1);
    expect(bundle?.definition.stopDate).toBeNull();
  });
});
