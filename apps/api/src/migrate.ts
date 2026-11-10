/**
 * Explicit migration step
 *
 * Applies pending database migrations, then exits. Run before the server
 * starts (see Dockerfile CMD and `pnpm db:migrate`). Never called by main.ts.
 */

import { getLedgerConfig, migrateLedger } from '@capital-care/ledger';

const { dbPath } = getLedgerConfig();

migrateLedger(dbPath);
console.log(`✓ Migrations applied to ${dbPath}`);
