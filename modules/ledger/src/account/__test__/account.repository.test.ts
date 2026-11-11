import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountRepository } from '../account.repository.js';
import { ConflictError } from '../../shared/errors.js';

// Real SQLite repository: ordering and the unique key only exist in the database.
const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../shared/persistence/migrations',
);

let sqlite: Database.Database;
let repository: AccountRepository;

beforeEach(() => {
  sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  repository = new AccountRepository(db);
});

afterEach(() => {
  sqlite.close();
});

describe('AccountRepository (real SQLite)', () => {
  it('C4 listByUser orders names alphabetically ignoring case and accents', () => {
    for (const name of ['cash', 'Bank A', 'credit card', 'Bank B', 'Ágata', 'Abc']) {
      repository.create({ userId: 'u1', name });
    }
    repository.create({ userId: 'u2', name: 'Aaa' });

    const names = repository.listByUser('u1').map((a) => a.name);

    expect(names).toEqual(['Abc', 'Ágata', 'Bank A', 'Bank B', 'cash', 'credit card']);
  });

  it('C15 unique key rejects a duplicate name ignoring case with a conflict', () => {
    repository.create({ userId: 'u1', name: 'Cash' });
    repository.create({ userId: 'u1', name: 'Poupança' });

    expect(() => repository.create({ userId: 'u1', name: 'cash' })).toThrow(ConflictError);
    expect(() => repository.create({ userId: 'u1', name: 'POUPANÇA' })).toThrow(ConflictError);

    const other = repository.create({ userId: 'u1', name: 'Bank A' });
    expect(() => repository.update(other.id, { name: 'CASH' })).toThrow(ConflictError);
    expect(repository.getById(other.id)?.name).toBe('Bank A');

    expect(repository.create({ userId: 'u2', name: 'Cash' }).userId).toBe('u2');
  });

  it('C33 the account table and its unique index exist', () => {
    const table = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'account'")
      .get();
    const index = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'account_userId_nameKey_unique'",
      )
      .get();

    expect(table).toBeDefined();
    expect(index).toBeDefined();
  });
});
