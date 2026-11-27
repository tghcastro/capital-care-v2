/**
 * Ledger module configuration
 *
 * Loads environment-specific configuration for the ledger module.
 */

export interface LedgerConfig {
  dbPath: string;
  /** The most accounts one user may have. A system setting, never user input. */
  accountLimit: number;
}

const DEFAULT_ACCOUNT_LIMIT = 99;

function parseAccountLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_ACCOUNT_LIMIT;

  // Surrounding whitespace is ignored; leading zeros are fine ("05" is 5).
  const trimmed = raw.trim();
  const limit = Number(trimmed);
  if (!/^[0-9]+$/.test(trimmed) || !Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(`ACCOUNT_LIMIT must be a whole number of at least 1, got "${raw}"`);
  }
  return limit;
}

/** DB_PATH, or the local default. Shared with the backup commands. */
export function getDbPath(env: Record<string, string | undefined> = process.env): string {
  return env.DB_PATH || './data/capital-care.db';
}

export function getLedgerConfig(): LedgerConfig {
  const dbPath = getDbPath();
  const accountLimit = parseAccountLimit(process.env.ACCOUNT_LIMIT);

  return {
    dbPath,
    accountLimit,
  };
}
