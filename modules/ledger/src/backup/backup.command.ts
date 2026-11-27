import { getDbPath } from '../config.js';
import { MIGRATIONS_FOLDER } from '../shared/persistence/migrate.js';
import { nodeBackupFiles, readNewestJournalMigration, sqliteBackupEngine } from './backup.adapters.js';
import { parseBackupKeep } from './backup.names.js';
import { BackupService } from './backup.service.js';
import { BackupError, type Clock } from './backup.types.js';

const DEFAULT_BACKUP_DIR = './backups';

export interface CommandIo {
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  err: (line: string) => void;
  clock?: Clock;
}

const processIo: CommandIo = {
  env: process.env,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

function createService(io: CommandIo): BackupService {
  return new BackupService(
    nodeBackupFiles(),
    sqliteBackupEngine(),
    {
      dbPath: getDbPath(io.env),
      backupDir: io.env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
      keep: parseBackupKeep(io.env.BACKUP_KEEP),
      appNewestMigration: readNewestJournalMigration(MIGRATIONS_FOLDER),
    },
    io.clock ?? (() => new Date())
  );
}

function reason(error: unknown): string {
  return error instanceof BackupError || error instanceof Error ? error.message : String(error);
}

/** `backup` command: prints the new backup's name; returns the exit code. */
export async function runBackupCommand(io: CommandIo = processIo): Promise<number> {
  try {
    const name = await createService(io).backup();
    io.out(`Backup created: ${name}`);
    return 0;
  } catch (error) {
    io.err(`Backup failed: ${reason(error)}`);
    return 1;
  }
}

/** `restore <name>` command: the app must be stopped; returns the exit code. */
export async function runRestoreCommand(name: string | undefined, io: CommandIo = processIo): Promise<number> {
  try {
    const result = await createService(io).restore(name);
    io.out(
      result.preRestore
        ? `Restored ${result.restored}. Current data saved as ${result.preRestore}.`
        : `Restored ${result.restored}. There was no current data to save.`
    );
    return 0;
  } catch (error) {
    io.err(`Restore failed: ${reason(error)}. Current data was not changed.`);
    return 1;
  }
}
