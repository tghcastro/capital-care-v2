/**
 * Backup and restore of the database file (CAP-24): the ports the service uses, so the rules can
 * be unit-tested without a real file system or SQLite.
 */

/** File operations on backups and the database file. */
export interface BackupFiles {
  /** true when a file or folder exists at the path */
  exists(path: string): boolean;
  /** file names (not paths) directly inside the folder */
  list(dir: string): string[];
  /** atomic rename within one file system */
  rename(from: string, to: string): void;
  /** removes the file; no error when it is already gone */
  remove(path: string): void;
  copy(from: string, to: string): void;
}

/** SQLite operations. */
export interface BackupEngine {
  /** Consistent online copy of the database at `source` into a new file at `dest`. */
  backup(source: string, dest: string): Promise<void>;
  /** true when the file is a SQLite database whose integrity check is `ok` */
  isHealthy(path: string): boolean;
  /** newest `created_at` in the file's applied migrations, or null when it records none */
  newestMigration(path: string): number | null;
}

export interface BackupSettings {
  dbPath: string;
  backupDir: string;
  /** how many backups to keep, at least 1 */
  keep: number;
  /** `when` of the newest migration this app ships */
  appNewestMigration: number;
}

export type Clock = () => Date;

export interface BackupResult {
  name: string;
  /** problems after the backup succeeded, such as old backups that could not be deleted */
  warnings: string[];
}

export interface RestoreResult {
  restored: string;
  /** name of the backup of the data that was replaced, or null when there was none */
  preRestore: string | null;
  /** problems after the restore succeeded, such as old backups that could not be deleted */
  warnings: string[];
}

/** A failure the owner can act on; its message is the reason printed after "failed:". */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}
