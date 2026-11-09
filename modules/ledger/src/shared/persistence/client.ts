import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

let dbInstance: BetterSQLite3Database | null = null;

export function getDatabase(dbPath: string): BetterSQLite3Database {
  if (!dbInstance) {
    const sqlite = new Database(dbPath);
    // Enable foreign key constraints
    sqlite.pragma('foreign_keys = ON');
    dbInstance = drizzle(sqlite);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    // Drizzle doesn't expose the underlying better-sqlite3 connection
    // In production, you'd need to store the sqlite instance separately if you need explicit cleanup
    dbInstance = null;
  }
}
