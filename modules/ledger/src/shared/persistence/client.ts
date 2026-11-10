import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

let sqliteInstance: Database.Database | null = null;
let dbInstance: BetterSQLite3Database | null = null;

export function getDatabase(dbPath: string): BetterSQLite3Database {
  if (!dbInstance) {
    const sqlite = new Database(dbPath);
    // Enable foreign key constraints
    sqlite.pragma('foreign_keys = ON');
    sqliteInstance = sqlite;
    dbInstance = drizzle(sqlite);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (sqliteInstance) {
    sqliteInstance.close();
  }
  sqliteInstance = null;
  dbInstance = null;
}
