import path from 'node:path';
import { formatBackupName, isBackupName, type BackupKind } from './backup.names.js';
import {
  BackupError,
  type BackupEngine,
  type BackupFiles,
  type BackupSettings,
  type Clock,
  type RestoreResult,
} from './backup.types.js';

/** Files SQLite may keep beside the database; a stale one would be applied to a restored file. */
const SIDECARS = ['-journal', '-wal', '-shm'];

/**
 * Backup and restore rules (CAP-24): naming, pruning, the restore checks and the order of the
 * restore steps. Restore expects the app to be stopped (scripts/db-restore.sh does that).
 */
export class BackupService {
  constructor(
    private readonly files: BackupFiles,
    private readonly engine: BackupEngine,
    private readonly settings: BackupSettings,
    private readonly clock: Clock
  ) {}

  /** Takes a backup of the running database and returns its name. */
  async backup(): Promise<string> {
    const { dbPath, backupDir } = this.settings;
    if (!this.files.exists(backupDir)) throw new BackupError(`the backup folder ${backupDir} does not exist`);
    if (!this.files.exists(dbPath)) throw new BackupError(`there is no database at ${dbPath}`);

    const name = await this.copyDatabase('backup');
    this.prune();
    return name;
  }

  /** Replaces the database with the backup `name`, saving the current data first. */
  async restore(name: string | undefined): Promise<RestoreResult> {
    const { dbPath, backupDir } = this.settings;
    if (!name) throw new BackupError('no backup name was given');
    if (!isBackupName(name)) throw new BackupError(`"${name}" is not a backup name`);
    const chosen = path.join(backupDir, name);
    if (!this.files.exists(chosen)) throw new BackupError(`there is no backup named ${name} in ${backupDir}`);
    if (!this.engine.isHealthy(chosen)) throw new BackupError(`${name} is damaged or is not a database`);
    const newest = this.engine.newestMigration(chosen);
    if (newest !== null && newest > this.settings.appNewestMigration) {
      throw new BackupError('the backup comes from a newer version of the app');
    }

    let preRestore: string | null = null;
    if (this.files.exists(dbPath)) {
      try {
        preRestore = await this.copyDatabase('pre-restore');
      } catch (error) {
        throw new BackupError(`could not save the current data: ${reason(error)}`);
      }
    }

    const staging = `${dbPath}.restoring`;
    try {
      this.files.copy(chosen, staging);
      this.files.rename(staging, dbPath);
    } catch (error) {
      this.files.remove(staging);
      throw new BackupError(`could not put the backup in place: ${reason(error)}`);
    }
    // The app is stopped, so any journal beside the database belonged to the replaced file.
    for (const suffix of SIDECARS) this.files.remove(`${dbPath}${suffix}`);

    this.prune();
    return { restored: name, preRestore };
  }

  /** Online copy of the database into a new backup; never leaves a partial file behind. */
  private async copyDatabase(kind: BackupKind): Promise<string> {
    const name = formatBackupName(this.clock(), kind);
    const dest = path.join(this.settings.backupDir, name);
    if (this.files.exists(dest)) throw new BackupError(`a backup named ${name} already exists`);

    const partial = `${dest}.partial`;
    try {
      await this.engine.backup(this.settings.dbPath, partial);
      this.files.rename(partial, dest);
    } catch (error) {
      this.files.remove(partial);
      throw error;
    }
    return name;
  }

  /** Deletes the oldest backups beyond `keep`; other files in the folder are left alone. */
  private prune(): void {
    const backups = this.files.list(this.settings.backupDir).filter(isBackupName).sort(byTime);
    const excess = backups.length - this.settings.keep;
    for (const name of backups.slice(0, Math.max(0, excess))) {
      this.files.remove(path.join(this.settings.backupDir, name));
    }
  }
}

/** Orders by the timestamp in the name; a pre-restore suffix does not change the order. */
function byTime(a: string, b: string): number {
  const stamp = (name: string) => name.slice('capital-care-'.length, 'capital-care-'.length + 18);
  return stamp(a).localeCompare(stamp(b));
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
