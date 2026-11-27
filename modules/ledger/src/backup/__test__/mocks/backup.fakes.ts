import path from 'node:path';
import type { BackupEngine, BackupFiles } from '../../backup.types.js';

/**
 * In-memory file system for backup unit tests. A "database file" is a string; the fake engine
 * copies it. Every change is logged in order so tests can assert the order of steps.
 */
export class FakeFiles implements BackupFiles {
  readonly files = new Map<string, string>();
  readonly dirs = new Set<string>();
  readonly log: string[] = [];
  failCopy = false;
  failRenameTo: string | null = null;
  failRemove: RegExp | null = null;

  exists(p: string): boolean {
    return this.files.has(p) || this.dirs.has(p);
  }

  list(dir: string): string[] {
    return [...this.files.keys()].filter((p) => path.dirname(p) === dir).map((p) => path.basename(p));
  }

  rename(from: string, to: string): void {
    if (this.failRenameTo === to) throw new Error(`EIO: rename to ${to}`);
    const content = this.files.get(from);
    if (content === undefined) throw new Error(`ENOENT: ${from}`);
    this.files.delete(from);
    this.files.set(to, content);
    this.log.push(`rename ${path.basename(from)} -> ${path.basename(to)}`);
  }

  remove(p: string): void {
    if (this.failRemove?.test(p) && this.files.has(p)) throw new Error('EACCES: permission denied');
    if (this.files.delete(p)) this.log.push(`remove ${path.basename(p)}`);
  }

  copy(from: string, to: string): void {
    if (this.failCopy) throw new Error('ENOSPC: no space left on device');
    const content = this.files.get(from);
    if (content === undefined) throw new Error(`ENOENT: ${from}`);
    this.files.set(to, content);
    this.log.push(`copy ${path.basename(from)} -> ${path.basename(to)}`);
  }
}

/** Fake SQLite engine over FakeFiles. Content containing "DAMAGED" fails the integrity check. */
export class FakeEngine implements BackupEngine {
  readonly migrations = new Map<string, number | null>();
  failBackup = false;
  failBackupWith: string | null = null;

  constructor(private readonly fs: FakeFiles) {}

  async backup(source: string, dest: string): Promise<void> {
    const content = this.fs.files.get(source);
    if (content === undefined) throw new Error(`no database at ${source}`);
    // A failing copy leaves a half-written destination behind, as a real one would.
    this.fs.files.set(dest, content.slice(0, 1));
    if (this.failBackupWith) throw new Error(this.failBackupWith);
    if (this.failBackup) throw new Error('SQLITE_FULL: database or disk is full');
    this.fs.files.set(dest, content);
    this.fs.log.push(`backup ${path.basename(source)} -> ${path.basename(dest)}`);
  }

  isHealthy(p: string): boolean {
    const content = this.fs.files.get(p);
    return content !== undefined && !content.includes('DAMAGED');
  }

  newestMigration(p: string): number | null {
    return this.migrations.get(p) ?? null;
  }
}

/** A clock that returns the given instants in order, then keeps returning the last one. */
export function clockOf(...isoInstants: string[]): () => Date {
  let i = 0;
  return () => new Date(isoInstants[Math.min(i++, isoInstants.length - 1)] as string);
}
