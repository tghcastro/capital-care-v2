/**
 * Database restore command (CAP-24)
 *
 * Usage: node dist/restore.js <backup-file-name>. The server must be stopped: run it through
 * scripts/db-restore.sh. See docs/operations/backup-and-restore.md.
 */

import { runRestoreCommand } from '@capital-care/ledger';

process.exitCode = await runRestoreCommand(process.argv[2]);
