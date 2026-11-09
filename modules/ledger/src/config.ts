/**
 * Ledger module configuration
 *
 * Loads environment-specific configuration for the ledger module.
 */

export interface LedgerConfig {
  dbPath: string;
}

export function getLedgerConfig(): LedgerConfig {
  const dbPath = process.env.DB_PATH || './data/capital-care.db';

  return {
    dbPath,
  };
}
