import { BackupError } from './backup.types.js';

/** Plan door 2: `capital-care-<YYYYMMDD>T<HHMMSS><mmm>Z[-pre-restore].db`, UTC. Names sort by time. */
const BACKUP_NAME = /^capital-care-\d{8}T\d{9}Z(-pre-restore)?\.db$/;

export const DEFAULT_BACKUP_KEEP = 5;

export type BackupKind = 'backup' | 'pre-restore';

export function formatBackupName(at: Date, kind: BackupKind): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace('.', ''); // 20261127T210500123Z
  return `capital-care-${stamp}${kind === 'pre-restore' ? '-pre-restore' : ''}.db`;
}

export function isBackupName(name: string): boolean {
  return BACKUP_NAME.test(name);
}

/** BACKUP_KEEP: a whole number of at least 1; 5 when unset. */
export function parseBackupKeep(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_BACKUP_KEEP;
  const trimmed = raw.trim();
  const keep = Number(trimmed);
  if (!/^[0-9]+$/.test(trimmed) || !Number.isSafeInteger(keep) || keep < 1) {
    throw new BackupError(`BACKUP_KEEP must be a whole number of at least 1, got "${raw}"`);
  }
  return keep;
}
