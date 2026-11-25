import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLedgerDatabase } from '../../shared/persistence/migrate.js';
import { CategoryRepository } from '../category.repository.js';
import { CategoryService } from '../category.service.js';
import { ConflictError } from '../../shared/errors.js';

// Integration on real SQLite: migration 0003 (plan S9, AD-012) and the constraints it creates
// (doors 1 and 2), which only exist in the database.
const MIGRATIONS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../shared/persistence/migrations'
);

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-0003-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A copy of the migrations folder holding only the first `count` migrations. */
function migrationsUpTo(count: number): string {
  const folder = path.join(dir, 'migrations');
  fs.mkdirSync(path.join(folder, 'meta'), { recursive: true });
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS, 'meta/_journal.json'), 'utf8')
  ) as {
    entries: { tag: string }[];
  };
  journal.entries = journal.entries.slice(0, count);
  fs.writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify(journal));
  for (const { tag } of journal.entries) {
    fs.copyFileSync(path.join(MIGRATIONS, `${tag}.sql`), path.join(folder, `${tag}.sql`));
  }
  return folder;
}

function count(sqlite: Database.Database, sql: string): number {
  return (sqlite.prepare(sql).get() as { n: number }).n;
}

describe('migration 0003', () => {
  it('AC45 deletes every category, keeps transactions with no category and adds parentId and nameKey', () => {
    const file = path.join(dir, 'ledger.db');
    migrateLedgerDatabase(file, migrationsUpTo(3));

    const before = new Database(file);
    before.pragma('foreign_keys = ON');
    before.exec(`
      INSERT INTO category (id, userId, name, description, createdAt, updatedAt) VALUES
        ('c1', 'alice', 'Housing', NULL, 0, 0), ('c2', 'alice', 'housing x', NULL, 0, 0);
      INSERT INTO "transaction" (id, userId, startDate, frequency, createdAt, updatedAt) VALUES
        ('t1', 'alice', '2026-11-05', 'monthly', 0, 0);
      INSERT INTO transaction_revision (transactionId, effectiveFrom, description, categoryId, accountId, type, amount)
        VALUES ('t1', '2026-11-05', 'Rent', 'c1', NULL, 'debit', '100');
      INSERT INTO transaction_settlement (transactionId, occurrenceDate, description, categoryId, accountId, type, amount, settledAt)
        VALUES ('t1', '2026-11-05', 'Rent', 'c2', NULL, 'debit', '100', 0);
    `);
    before.close();

    migrateLedgerDatabase(file, MIGRATIONS);

    const after = new Database(file);
    try {
      expect(count(after, 'SELECT COUNT(*) AS n FROM category')).toBe(0);
      expect(count(after, 'SELECT COUNT(*) AS n FROM "transaction"')).toBe(1);
      expect(after.prepare('SELECT categoryId FROM transaction_revision').all()).toEqual([
        { categoryId: null },
      ]);
      expect(after.prepare('SELECT categoryId FROM transaction_settlement').all()).toEqual([
        { categoryId: null },
      ]);

      const columns = (
        after.prepare(`PRAGMA table_info(category)`).all() as { name: string; notnull: number }[]
      ).map((c) => [c.name, c.notnull]);
      expect(columns).toEqual(
        expect.arrayContaining([
          ['parentId', 0],
          ['nameKey', 1],
        ])
      );
      const fks = after.prepare(`PRAGMA foreign_key_list(category)`).all() as {
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }[];
      expect(fks).toEqual([
        expect.objectContaining({
          table: 'category',
          from: 'parentId',
          to: 'id',
          on_delete: 'CASCADE',
        }),
      ]);
      const indexes = after.prepare(`PRAGMA index_list(category)`).all() as {
        name: string;
        unique: number;
      }[];
      expect(indexes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'category_userId_nameKey_unique', unique: 1 }),
        ])
      );
      expect(indexes.map((i) => i.name)).not.toContain('category_userId_name_unique');
      const keyColumns = (
        after.prepare(`PRAGMA index_info(category_userId_nameKey_unique)`).all() as {
          name: string;
        }[]
      ).map((c) => c.name);
      expect(keyColumns).toEqual(['userId', 'nameKey']);
    } finally {
      after.close();
    }
  });
});

describe('category table on real SQLite', () => {
  let sqlite: Database.Database;
  let service: CategoryService;
  let repository: CategoryRepository;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: MIGRATIONS });
    repository = new CategoryRepository(db);
    service = new CategoryService(repository);
  });

  afterEach(() => sqlite.close());

  it('AC22 deleting a category deletes its descendants in the database', () => {
    const food = service.createCategory({ name: 'Food', userId: 'alice' });
    const groceries = service.createCategory({
      name: 'Groceries',
      parentId: food.id,
      userId: 'alice',
    });
    service.createCategory({ name: 'Fruit', parentId: groceries.id, userId: 'alice' });
    service.createCategory({ name: 'Home', userId: 'alice' });
    service.deleteCategory(food.id, 'alice');
    expect(repository.listByUser('alice').map((c) => c.name)).toEqual(['Home']);
  });

  it('AC13 the unique key refuses a second row with the same name key and answers name is taken', () => {
    repository.create({
      userId: 'alice',
      parentId: null,
      name: 'Saúde',
      nameKey: 'saúde',
      description: null,
    });
    expect(() =>
      repository.create({
        userId: 'alice',
        parentId: null,
        name: 'SAÚDE',
        nameKey: 'saúde',
        description: null,
      })
    ).toThrow(new ConflictError('name is taken'));
    expect(() =>
      repository.create({
        userId: 'bob',
        parentId: null,
        name: 'Saúde',
        nameKey: 'saúde',
        description: null,
      })
    ).not.toThrow();
  });
});
