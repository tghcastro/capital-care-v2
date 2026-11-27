import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLedgerDatabase } from '../../shared/persistence/migrate.js';
import { runBackupCommand, runRestoreCommand, type CommandIo } from '../backup.command.js';
import { BackupService } from '../backup.service.js';
import { nodeBackupFiles, readNewestJournalMigration, sqliteBackupEngine } from '../backup.adapters.js';
import { clockOf } from './mocks/backup.fakes.js';

// Integration on real SQLite files: the backup commands, the online backup, restore and the
// version check (plan S1, S2).
const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../shared/persistence/migrations');

let dir: string;
let dbPath: string;
let backupDir: string;
let out: string[];
let err: string[];

function io(clock: () => Date, env: Record<string, string> = {}): CommandIo {
  return {
    env: { DB_PATH: dbPath, BACKUP_DIR: backupDir, ...env },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    clock,
  };
}

function open(file: string): Database.Database {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  return db;
}

function addCategory(file: string, id: string, name: string): void {
  const db = open(file);
  db.prepare(
    'INSERT INTO category (id, userId, parentId, name, nameKey, description, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?, NULL, 0, 0)'
  ).run(id, 'owner', name, name.toLowerCase());
  db.close();
}

function categoryNames(file: string): string[] {
  const db = open(file);
  const rows = db.prepare('SELECT name FROM category ORDER BY name').all() as { name: string }[];
  db.close();
  return rows.map((r) => r.name);
}

/** A copy of the migrations folder holding only the first `count` migrations. */
function migrationsUpTo(count: number): string {
  const folder = path.join(dir, 'migrations');
  fs.mkdirSync(path.join(folder, 'meta'), { recursive: true });
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  journal.entries = journal.entries.slice(0, count);
  fs.writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify(journal));
  for (const { tag } of journal.entries) {
    fs.copyFileSync(path.join(MIGRATIONS, `${tag}.sql`), path.join(folder, `${tag}.sql`));
  }
  return folder;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-backup-'));
  dbPath = path.join(dir, 'data', 'capital-care.db');
  backupDir = path.join(dir, 'backups');
  fs.mkdirSync(path.dirname(dbPath));
  fs.mkdirSync(backupDir);
  migrateLedgerDatabase(dbPath);
  out = [];
  err = [];
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('backup command', () => {
  it('AC1 backup command prints the name and exits 0', async () => {
    const code = await runBackupCommand(io(clockOf('2026-11-27T21:05:00.123Z')));
    expect(code).toBe(0);
    expect(out).toEqual(['Backup created: capital-care-20261127T210500123Z.db']);
    expect(err).toEqual([]);
    expect(fs.readdirSync(backupDir)).toEqual(['capital-care-20261127T210500123Z.db']);
  });

  it('AC2 the backup holds the same rows and passes integrity_check', async () => {
    addCategory(dbPath, 'c1', 'Food');
    addCategory(dbPath, 'c2', 'Rent');
    await runBackupCommand(io(clockOf('2026-11-27T21:05:00.123Z')));
    const file = path.join(backupDir, 'capital-care-20261127T210500123Z.db');
    expect(categoryNames(file)).toEqual(['Food', 'Rent']);
    const db = new Database(file, { readonly: true });
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    db.close();
  });

  it('AC3 a write committed during the backup is all or nothing in it', async () => {
    // Enough pages that the online backup takes several steps.
    const app = open(dbPath);
    app.exec('CREATE TABLE filler (id INTEGER PRIMARY KEY, pad TEXT)');
    const fill = app.prepare('INSERT INTO filler (pad) VALUES (?)');
    app.transaction(() => {
      for (let i = 0; i < 2000; i++) fill.run('x'.repeat(1000));
    })();

    let wrote = false;
    let writeError: unknown = null;
    const engine = sqliteBackupEngine({
      pagesPerStep: 10,
      onStep: () => {
        if (wrote) return;
        wrote = true;
        try {
          app.transaction(() => {
            for (let i = 0; i < 1000; i++) {
              app.prepare(
                'INSERT INTO category (id, userId, parentId, name, nameKey, description, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?, NULL, 0, 0)'
              ).run(`c${i}`, 'owner', `Cat ${i}`, `cat ${i}`);
            }
          })();
        } catch (e) {
          writeError = e;
        }
      },
    });
    const dest = path.join(backupDir, 'during.db');
    await engine.backup(dbPath, dest);
    app.close();

    expect(wrote).toBe(true);
    expect(writeError).toBeNull();
    const n = (new Database(dest, { readonly: true }).prepare('SELECT count(*) AS n FROM category').get() as { n: number }).n;
    expect([0, 1000]).toContain(n);
  });

  it('AC6 backup command rejects an invalid BACKUP_KEEP before writing anything', async () => {
    for (const raw of ['0', '-1', '2.5', 'abc']) {
      out = [];
      err = [];
      const code = await runBackupCommand(io(clockOf('2026-11-27T21:05:00.123Z'), { BACKUP_KEEP: raw }));
      expect(code, raw).toBe(1);
      expect(err, raw).toEqual([`Backup failed: BACKUP_KEEP must be a whole number of at least 1, got "${raw}"`]);
      expect(out, raw).toEqual([]);
    }
    expect(fs.readdirSync(backupDir)).toEqual([]);
  });

  it('AC7 backup command fails when the backup folder is missing', async () => {
    fs.rmSync(backupDir, { recursive: true });
    const code = await runBackupCommand(io(clockOf('2026-11-27T21:05:00.123Z')));
    expect(code).toBe(1);
    expect(err).toEqual([`Backup failed: the backup folder ${backupDir} does not exist`]);
  });

  it('AC7 backup command fails when the database file is missing and creates none', async () => {
    fs.rmSync(dbPath);
    const code = await runBackupCommand(io(clockOf('2026-11-27T21:05:00.123Z')));
    expect(code).toBe(1);
    expect(err).toEqual([`Backup failed: there is no database at ${dbPath}`]);
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.readdirSync(backupDir)).toEqual([]);
  });
});

describe('restore command', () => {
  it('AC8 restore brings back a deleted category and saves the current data first', async () => {
    addCategory(dbPath, 'c1', 'Groceries');
    await runBackupCommand(io(clockOf('2026-11-26T12:00:00.000Z')));

    // 27 Nov: the category is deleted by mistake, and a new one is added after the backup
    const db = open(dbPath);
    db.prepare('DELETE FROM category WHERE id = ?').run('c1');
    db.close();
    addCategory(dbPath, 'c2', 'Leisure');

    out = [];
    const code = await runRestoreCommand('capital-care-20261126T120000000Z.db', io(clockOf('2026-11-27T09:00:00.000Z')));

    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out).toEqual([
      'Restored capital-care-20261126T120000000Z.db. Current data saved as capital-care-20261127T090000000Z-pre-restore.db.',
    ]);
    expect(categoryNames(dbPath)).toEqual(['Groceries']);
    expect(categoryNames(path.join(backupDir, 'capital-care-20261127T090000000Z-pre-restore.db'))).toEqual(['Leisure']);
  });

  it('AC9 restoring the pre-restore backup undoes the restore', async () => {
    addCategory(dbPath, 'c1', 'Groceries');
    await runBackupCommand(io(clockOf('2026-11-26T12:00:00.000Z')));
    addCategory(dbPath, 'c2', 'Leisure');
    await runRestoreCommand('capital-care-20261126T120000000Z.db', io(clockOf('2026-11-27T09:00:00.000Z')));
    expect(categoryNames(dbPath)).toEqual(['Groceries']);

    const code = await runRestoreCommand(
      'capital-care-20261127T090000000Z-pre-restore.db',
      io(clockOf('2026-11-27T09:10:00.000Z'))
    );
    expect(code).toBe(0);
    expect(categoryNames(dbPath)).toEqual(['Groceries', 'Leisure']);
  });

  it('AC10 restore with BACKUP_KEEP 1 keeps the restored data', async () => {
    addCategory(dbPath, 'c1', 'Groceries');
    await runBackupCommand(io(clockOf('2026-11-26T12:00:00.000Z'), { BACKUP_KEEP: '1' }));
    addCategory(dbPath, 'c2', 'Leisure');

    const code = await runRestoreCommand(
      'capital-care-20261126T120000000Z.db',
      io(clockOf('2026-11-27T09:00:00.000Z'), { BACKUP_KEEP: '1' })
    );

    expect(code).toBe(0);
    expect(categoryNames(dbPath)).toEqual(['Groceries']);
    expect(fs.readdirSync(backupDir)).toEqual(['capital-care-20261127T090000000Z-pre-restore.db']);
  });

  it('AC11 restore command prints the failure and exits 1', async () => {
    addCategory(dbPath, 'c1', 'Groceries');
    const before = fs.readFileSync(dbPath);
    const code = await runRestoreCommand('../capital-care.db', io(clockOf('2026-11-27T09:00:00.000Z')));
    expect(code).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual(['Restore failed: "../capital-care.db" is not a backup name. Current data was not changed.']);
    expect(fs.readFileSync(dbPath).equals(before)).toBe(true);

    err = [];
    expect(await runRestoreCommand(undefined, io(clockOf('2026-11-27T09:00:00.000Z')))).toBe(1);
    expect(err).toEqual(['Restore failed: no backup name was given. Current data was not changed.']);
  });

  it('AC12 a text file named as a backup is refused', async () => {
    const name = 'capital-care-20261126T120000000Z.db';
    fs.writeFileSync(path.join(backupDir, name), 'this is not a database, just some text that is long enough');
    const before = fs.readFileSync(dbPath);

    const code = await runRestoreCommand(name, io(clockOf('2026-11-27T09:00:00.000Z')));

    expect(code).toBe(1);
    expect(err).toEqual([`Restore failed: ${name} is damaged or is not a database. Current data was not changed.`]);
    expect(fs.readdirSync(backupDir)).toEqual([name]);
    expect(fs.readFileSync(dbPath).equals(before)).toBe(true);
  });

  it('AC13 reads the newest migration from a backup and from the journal', async () => {
    const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as {
      entries: { when: number }[];
    };
    const newest = Math.max(...journal.entries.map((e) => e.when));
    expect(readNewestJournalMigration(MIGRATIONS)).toBe(newest);

    const engine = sqliteBackupEngine();
    expect(engine.newestMigration(dbPath)).toBe(newest);

    const older = path.join(dir, 'older.db');
    migrateLedgerDatabase(older, migrationsUpTo(3));
    expect(engine.newestMigration(older)).toBe(journal.entries[2]?.when);

    const empty = path.join(dir, 'empty.db');
    new Database(empty).close();
    expect(engine.newestMigration(empty)).toBeNull();
  });

  it('AC14 an older backup restores and the migrate step brings it up to date', async () => {
    const olderDb = path.join(dir, 'older', 'capital-care.db');
    fs.mkdirSync(path.dirname(olderDb));
    migrateLedgerDatabase(olderDb, migrationsUpTo(3));
    const files = nodeBackupFiles();
    const engine = sqliteBackupEngine();
    const settings = { backupDir, keep: 5, appNewestMigration: readNewestJournalMigration(MIGRATIONS) };
    const name = await new BackupService(files, engine, { ...settings, dbPath: olderDb }, clockOf('2026-11-20T00:00:00.000Z')).backup();

    await new BackupService(files, engine, { ...settings, dbPath }, clockOf('2026-11-27T09:00:00.000Z')).restore(name);
    const restored = open(dbPath);
    expect((restored.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number }).n).toBe(3);
    restored.close();

    migrateLedgerDatabase(dbPath);

    const migrated = open(dbPath);
    expect((migrated.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number }).n).toBe(4);
    const columns = (migrated.prepare('PRAGMA table_info(category)').all() as { name: string }[]).map((c) => c.name);
    migrated.close();
    expect(columns).toContain('parentId');
  });

  it('AC16 restore with no current data skips the pre-restore backup', async () => {
    addCategory(dbPath, 'c1', 'Groceries');
    await runBackupCommand(io(clockOf('2026-11-26T12:00:00.000Z')));
    fs.rmSync(dbPath);

    const code = await runRestoreCommand('capital-care-20261126T120000000Z.db', io(clockOf('2026-11-27T09:00:00.000Z')));

    expect(code).toBe(0);
    expect(out.at(-1)).toBe('Restored capital-care-20261126T120000000Z.db. There was no current data to save.');
    expect(categoryNames(dbPath)).toEqual(['Groceries']);
    expect(fs.readdirSync(backupDir)).toEqual(['capital-care-20261126T120000000Z.db']);
  });
});
