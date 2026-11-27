import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { BackupEngine, BackupFiles } from './backup.types.js';

/** BackupFiles on the real file system. */
export function nodeBackupFiles(): BackupFiles {
  return {
    exists: (p) => fs.existsSync(p),
    list: (dir) => fs.readdirSync(dir),
    rename: (from, to) => fs.renameSync(from, to),
    remove: (p) => fs.rmSync(p, { force: true }),
    copy: (from, to) => {
      fs.copyFileSync(from, to);
      const fd = fs.openSync(to, 'r+');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    },
  };
}

export interface SqliteBackupOptions {
  /** pages copied per step of the online backup; SQLite's default when unset */
  pagesPerStep?: number;
  /** called between steps (tests use it to write while a backup runs) */
  onStep?: () => void;
}

/**
 * BackupEngine on better-sqlite3. `backup` uses SQLite's online backup API, which restarts the
 * copy when another connection writes, so the result is a single consistent moment
 * (database.md: never copy the live file).
 */
export function sqliteBackupEngine(options: SqliteBackupOptions = {}): BackupEngine {
  return {
    async backup(source, dest) {
      const db = new Database(source, { readonly: true, fileMustExist: true });
      try {
        await db.backup(dest, {
          progress: () => {
            options.onStep?.();
            return options.pagesPerStep ?? 100;
          },
        });
      } finally {
        db.close();
      }
    },

    isHealthy(file) {
      let db: Database.Database | null = null;
      try {
        db = new Database(file, { readonly: true, fileMustExist: true });
        return db.pragma('integrity_check', { simple: true }) === 'ok';
      } catch {
        return false;
      } finally {
        db?.close();
      }
    },

    newestMigration(file) {
      const db = new Database(file, { readonly: true, fileMustExist: true });
      try {
        const table = db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
          .get();
        if (!table) return null;
        const row = db.prepare('SELECT max(created_at) AS newest FROM __drizzle_migrations').get() as {
          newest: number | null;
        };
        return row.newest === null ? null : Number(row.newest);
      } finally {
        db.close();
      }
    },
  };
}

/** `when` of the newest migration in a Drizzle migrations folder's journal. */
export function readNewestJournalMigration(migrationsFolder: string): number {
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as {
    entries: { when: number }[];
  };
  return Math.max(...journal.entries.map((entry) => entry.when));
}
