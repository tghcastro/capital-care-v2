/**
 * Database backup command (CAP-24)
 *
 * Takes a consistent backup of the running database into BACKUP_DIR and prunes the oldest beyond
 * BACKUP_KEEP. Safe while the server runs. See docs/operations/backup-and-restore.md.
 */

import { runBackupCommand } from '@capital-care/ledger';

process.exitCode = await runBackupCommand();
