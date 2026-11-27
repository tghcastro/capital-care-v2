import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { BackupService } from '../backup.service.js';
import { formatBackupName, isBackupName, parseBackupKeep } from '../backup.names.js';
import { BackupError } from '../backup.types.js';
import { FakeEngine, FakeFiles, clockOf } from './mocks/backup.fakes.js';

// Unit: the backup and restore rules (plan S1, S2) with an in-memory file system and engine.
const DIR = '/backups';
const DB = '/data/capital-care.db';
const APP_NEWEST = 1795627774108;

let fs: FakeFiles;
let engine: FakeEngine;

function service(keep: number, clock: () => Date = clockOf('2026-11-27T21:05:00.123Z')) {
  return new BackupService(fs, engine, { dbPath: DB, backupDir: DIR, keep, appNewestMigration: APP_NEWEST }, clock);
}

function backupsIn(dir = DIR): string[] {
  return fs.list(dir).sort();
}

function seedBackups(...names: string[]): void {
  for (const name of names) fs.files.set(path.join(DIR, name), `data of ${name}`);
}

beforeEach(() => {
  fs = new FakeFiles();
  engine = new FakeEngine(fs);
  fs.dirs.add(DIR);
  fs.files.set(DB, 'current data');
});

describe('backup names', () => {
  it('AC1 names the backup from the UTC clock with milliseconds', async () => {
    expect(formatBackupName(new Date('2026-11-27T21:05:00.123Z'), 'backup')).toBe('capital-care-20261127T210500123Z.db');
    expect(formatBackupName(new Date('2026-01-02T03:04:05.006Z'), 'pre-restore')).toBe(
      'capital-care-20260102T030405006Z-pre-restore.db'
    );

    const { name, warnings } = await service(5).backup();
    expect(warnings).toEqual([]);

    expect(name).toBe('capital-care-20261127T210500123Z.db');
    expect(fs.files.get(path.join(DIR, name))).toBe('current data');
    expect(backupsIn()).toEqual(['capital-care-20261127T210500123Z.db']);
  });

  it('door 2 recognises only backup names', () => {
    expect(isBackupName('capital-care-20261127T210500123Z.db')).toBe(true);
    expect(isBackupName('capital-care-20261127T210500123Z-pre-restore.db')).toBe(true);
    for (const name of ['notes.txt', '../capital-care.db', 'capital-care.db', 'capital-care-20261127T210500Z.db',
      'capital-care-20261127T210500123Z.db.partial', 'x/capital-care-20261127T210500123Z.db']) {
      expect(isBackupName(name), name).toBe(false);
    }
  });

  it('AC6 parses BACKUP_KEEP', () => {
    expect(parseBackupKeep(undefined)).toBe(5);
    expect(parseBackupKeep('05')).toBe(5);
    expect(parseBackupKeep('12')).toBe(12);
    for (const raw of ['0', '-1', '2.5', 'abc', '']) {
      expect(() => parseBackupKeep(raw), raw).toThrow(`BACKUP_KEEP must be a whole number of at least 1, got "${raw}"`);
    }
  });
});

describe('backup', () => {
  it('AC4 two backups 1 ms apart create two files', async () => {
    const svc = service(5, clockOf('2026-11-27T21:05:00.123Z', '2026-11-27T21:05:00.124Z'));
    await svc.backup();
    await svc.backup();
    expect(backupsIn()).toEqual(['capital-care-20261127T210500123Z.db', 'capital-care-20261127T210500124Z.db']);
  });

  it('AC4 a backup whose name exists fails and keeps the existing file', async () => {
    seedBackups('capital-care-20261127T210500123Z.db');
    await expect(service(5).backup()).rejects.toThrow(
      new BackupError('a backup named capital-care-20261127T210500123Z.db already exists')
    );
    expect(fs.files.get(path.join(DIR, 'capital-care-20261127T210500123Z.db'))).toBe(
      'data of capital-care-20261127T210500123Z.db'
    );
  });

  it('AC5 prunes the oldest beyond BACKUP_KEEP counting pre-restore backups', async () => {
    seedBackups(
      'capital-care-20261120T000000000Z.db',
      'capital-care-20261121T000000000Z-pre-restore.db',
      'capital-care-20261122T000000000Z.db',
      'capital-care-20261123T000000000Z.db',
      'capital-care-20261124T000000000Z.db'
    );
    await service(5).backup();
    expect(backupsIn()).toEqual([
      'capital-care-20261121T000000000Z-pre-restore.db',
      'capital-care-20261122T000000000Z.db',
      'capital-care-20261123T000000000Z.db',
      'capital-care-20261124T000000000Z.db',
      'capital-care-20261127T210500123Z.db',
    ]);

    // the pre-restore backup is now the oldest and is pruned like any other
    await service(5, clockOf('2026-11-28T00:00:00.000Z')).backup();
    expect(backupsIn()).not.toContain('capital-care-20261121T000000000Z-pre-restore.db');
    expect(backupsIn()).toHaveLength(5);
  });

  it('AC5 keeps every backup while under BACKUP_KEEP', async () => {
    seedBackups('capital-care-20261120T000000000Z.db', 'capital-care-20261121T000000000Z.db', 'capital-care-20261122T000000000Z.db');
    await service(5).backup();
    expect(backupsIn()).toHaveLength(4);
  });

  it('AC5 never touches files that are not backups', async () => {
    fs.files.set(path.join(DIR, 'notes.txt'), 'mine');
    fs.files.set(path.join(DIR, 'capital-care.db'), 'old copy');
    seedBackups('capital-care-20261120T000000000Z.db', 'capital-care-20261121T000000000Z.db');
    await service(1).backup();
    expect(backupsIn()).toEqual(['capital-care-20261127T210500123Z.db', 'capital-care.db', 'notes.txt']);
  });

  it('AC7 a failed copy removes the partial file and deletes no backup', async () => {
    seedBackups('capital-care-20261120T000000000Z.db');
    engine.failBackup = true;
    await expect(service(1).backup()).rejects.toThrow(/SQLITE_FULL/);
    expect(backupsIn()).toEqual(['capital-care-20261120T000000000Z.db']);
    expect(fs.files.get(DB)).toBe('current data');
  });

  it('AC7 a backup folder that is not writable fails and deletes no backup', async () => {
    seedBackups('capital-care-20261120T000000000Z.db');
    engine.failBackupWith = 'EACCES: permission denied, open \'/backups/capital-care-20261127T210500123Z.db.partial\'';
    await expect(service(1).backup()).rejects.toThrow(/EACCES: permission denied/);
    expect(backupsIn()).toEqual(['capital-care-20261120T000000000Z.db']);
    expect(fs.files.get(DB)).toBe('current data');
  });

  it('a pruning failure after a backup reports the backup with a warning', async () => {
    seedBackups('capital-care-20261120T000000000Z.db');
    fs.failRemove = /capital-care-20261120T000000000Z\.db$/;
    const result = await service(1).backup();
    expect(result).toEqual({
      name: 'capital-care-20261127T210500123Z.db',
      warnings: ['could not delete old backups: EACCES: permission denied'],
    });
    expect(backupsIn()).toContain('capital-care-20261127T210500123Z.db');
  });

  it('AC7 fails before copying when the folder or the database is missing', async () => {
    fs.dirs.delete(DIR);
    await expect(service(5).backup()).rejects.toThrow(new BackupError('the backup folder /backups does not exist'));

    fs.dirs.add(DIR);
    fs.files.delete(DB);
    await expect(service(5).backup()).rejects.toThrow(new BackupError('there is no database at /data/capital-care.db'));
    expect(backupsIn()).toEqual([]);
  });
});

describe('restore', () => {
  const CHOSEN = 'capital-care-20261126T120000000Z.db';
  const PRE = 'capital-care-20261127T210500123Z-pre-restore.db';

  beforeEach(() => {
    seedBackups(CHOSEN);
  });

  it('saves the current data first, then puts the chosen backup in place', async () => {
    const result = await service(5).restore(CHOSEN);
    expect(result).toEqual({ restored: CHOSEN, preRestore: PRE, warnings: [] });
    expect(fs.files.get(DB)).toBe(`data of ${CHOSEN}`);
    expect(fs.files.get(path.join(DIR, PRE))).toBe('current data');
    expect(backupsIn()).toEqual([CHOSEN, PRE].sort());
  });

  it('AC10 prunes only after the chosen backup is in place', async () => {
    const result = await service(1).restore(CHOSEN);
    expect(result.preRestore).toBe(PRE);
    expect(fs.files.get(DB)).toBe(`data of ${CHOSEN}`);
    expect(backupsIn()).toEqual([PRE]);
    const placed = fs.log.findIndex((entry) => entry.endsWith('-> capital-care.db'));
    const pruned = fs.log.indexOf(`remove ${CHOSEN}`);
    expect(placed).toBeGreaterThanOrEqual(0);
    expect(pruned).toBeGreaterThan(placed);
  });

  it('AC11 rejects a missing or invalid backup name and changes nothing', async () => {
    const cases: [string | undefined, string][] = [
      [undefined, 'no backup name was given'],
      ['', 'no backup name was given'],
      ['../capital-care.db', '"../capital-care.db" is not a backup name'],
      ['notes.txt', '"notes.txt" is not a backup name'],
      ['capital-care-20261101T000000000Z.db', 'there is no backup named capital-care-20261101T000000000Z.db in /backups'],
    ];
    for (const [name, reason] of cases) {
      await expect(service(5).restore(name), String(name)).rejects.toThrow(new BackupError(reason));
    }
    expect(fs.files.get(DB)).toBe('current data');
    expect(backupsIn()).toEqual([CHOSEN]);
    expect(fs.log).toEqual([]);
  });

  it('AC12 a damaged backup is refused without a pre-restore backup', async () => {
    fs.files.set(path.join(DIR, CHOSEN), 'DAMAGED');
    await expect(service(5).restore(CHOSEN)).rejects.toThrow(
      new BackupError(`${CHOSEN} is damaged or is not a database`)
    );
    expect(backupsIn()).toEqual([CHOSEN]);
    expect(fs.files.get(DB)).toBe('current data');
  });

  it('AC13 refuses a backup from a newer app version and accepts the same version', async () => {
    engine.migrations.set(path.join(DIR, CHOSEN), APP_NEWEST + 1);
    await expect(service(5).restore(CHOSEN)).rejects.toThrow(
      new BackupError('the backup comes from a newer version of the app')
    );
    expect(fs.files.get(DB)).toBe('current data');
    expect(backupsIn()).toEqual([CHOSEN]);

    engine.migrations.set(path.join(DIR, CHOSEN), APP_NEWEST);
    await expect(service(5).restore(CHOSEN)).resolves.toEqual({ restored: CHOSEN, preRestore: PRE, warnings: [] });

    // an older backup, and one with no migrations recorded, are accepted too
    engine.migrations.set(path.join(DIR, CHOSEN), APP_NEWEST - 1);
    await expect(service(5, clockOf('2026-11-28T00:00:00.000Z')).restore(CHOSEN)).resolves.toMatchObject({ restored: CHOSEN });
  });

  it('AC15 a failure after the checks leaves the database in place', async () => {
    const failures: [string, () => void, RegExp][] = [
      ['pre-restore backup', () => (engine.failBackup = true), /^could not save the current data: .*SQLITE_FULL/],
      ['copy', () => (fs.failCopy = true), /^could not put the backup in place: .*ENOSPC/],
      ['rename', () => (fs.failRenameTo = DB), /^could not put the backup in place: .*EIO/],
    ];
    for (const [step, inject, reason] of failures) {
      fs = new FakeFiles();
      engine = new FakeEngine(fs);
      fs.dirs.add(DIR);
      fs.files.set(DB, 'current data');
      seedBackups(CHOSEN);
      inject();

      const error = await service(5).restore(CHOSEN).catch((e: unknown) => e);
      expect(error, step).toBeInstanceOf(BackupError);
      expect((error as Error).message, step).toMatch(reason);
      expect(fs.files.get(DB), step).toBe('current data');
      expect(fs.list('/data'), step).toEqual(['capital-care.db']);
      expect(fs.list(DIR).filter((n) => n.endsWith('.partial')), step).toEqual([]);
    }
  });

  it('AC16 restore with no current data skips the pre-restore backup', async () => {
    fs.files.delete(DB);
    const result = await service(5).restore(CHOSEN);
    expect(result).toEqual({ restored: CHOSEN, preRestore: null, warnings: [] });
    expect(fs.files.get(DB)).toBe(`data of ${CHOSEN}`);
    expect(backupsIn()).toEqual([CHOSEN]);
  });

  it('a pruning failure after a restore reports the restore with a warning', async () => {
    fs.failRemove = /capital-care-20261126T120000000Z\.db$/; // CHOSEN
    const result = await service(1).restore(CHOSEN);
    expect(result).toEqual({
      restored: CHOSEN,
      preRestore: PRE,
      warnings: ['could not delete old backups: EACCES: permission denied'],
    });
    expect(fs.files.get(DB)).toBe(`data of ${CHOSEN}`);
  });

  it('a journal file that cannot be removed fails the restore before the database is replaced', async () => {
    fs.files.set(`${DB}-journal`, 'old journal');
    fs.failRemove = /capital-care\.db-journal$/;
    const error = await service(5).restore(CHOSEN).catch((e: unknown) => e);
    expect((error as Error).message).toBe('could not put the backup in place: EACCES: permission denied');
    expect(fs.files.get(DB)).toBe('current data');
    expect(fs.list('/data').sort()).toEqual(['capital-care.db', 'capital-care.db-journal']);
  });

  it('removes stale journal files of the replaced database', async () => {
    fs.files.set(`${DB}-journal`, 'old journal');
    fs.files.set(`${DB}-wal`, 'old wal');
    fs.files.set(`${DB}-shm`, 'old shm');
    await service(5).restore(CHOSEN);
    expect(fs.list('/data')).toEqual(['capital-care.db']);
  });
});
