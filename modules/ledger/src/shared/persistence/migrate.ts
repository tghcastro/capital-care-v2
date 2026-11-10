/**
 * Schema migrations
 *
 * Applies the committed SQL migrations to the database file. Called by the
 * explicit migration step (apps/api `migrate.ts`) before the server starts.
 * The application never changes the schema on its own.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Compiled file lives in dist/shared/persistence/; migrations are copied next to it.
const DEFAULT_MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

export function migrateLedgerDatabase(
  dbPath: string,
  migrationsFolder: string = DEFAULT_MIGRATIONS_FOLDER,
): void {
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma('foreign_keys = ON');
    migrate(drizzle(sqlite), { migrationsFolder });
  } finally {
    sqlite.close();
  }
}
