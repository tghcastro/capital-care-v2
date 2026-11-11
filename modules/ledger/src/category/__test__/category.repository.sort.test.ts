import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CategoryRepository } from '../category.repository.js';

// Real SQLite repository: the mock repository used elsewhere never runs the ORDER BY query.
const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../shared/persistence/migrations',
);

let sqlite: Database.Database;
let repository: CategoryRepository;

beforeEach(() => {
  sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  repository = new CategoryRepository(db);
});

afterEach(() => {
  sqlite.close();
});

function seed(userId: string, names: string[]): void {
  for (const name of names) {
    repository.create({ userId, name, description: null });
  }
}

describe('CategoryRepository.listByUser sort (real SQLite)', () => {
  it('sort=name returns the user categories ascending by name', () => {
    seed('user1', ['Mango', 'Zebra', 'Apple']);

    const names = repository.listByUser('user1', 'name').map((c) => c.name);

    expect(names).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('sort=-name returns the user categories descending by name', () => {
    seed('user1', ['Mango', 'Zebra', 'Apple']);

    const names = repository.listByUser('user1', '-name').map((c) => c.name);

    expect(names).toEqual(['Zebra', 'Mango', 'Apple']);
  });

  it('sort=-name returns only the requesting user categories', () => {
    seed('user1', ['Mango', 'Apple']);
    seed('user2', ['Zebra']);

    const names = repository.listByUser('user1', '-name').map((c) => c.name);

    expect(names).toEqual(['Mango', 'Apple']);
  });

  it('sort=-name on a user with no categories returns an empty array', () => {
    seed('user2', ['Zebra']);

    expect(repository.listByUser('user1', '-name')).toEqual([]);
  });
});
