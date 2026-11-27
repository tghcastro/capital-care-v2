# Database Backup and Restore verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at e7fa539
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `backup.service.test.ts` `AC1 names the backup from the UTC clock with milliseconds`; `backup.integration.test.ts` `AC1 backup command prints the name and exits 0` | yes |
| C2 | `backup.integration.test.ts` `AC2 the backup holds the same rows and passes integrity_check` | yes |
| C3 | `backup.integration.test.ts` `AC3 a write committed during the backup is all or nothing in it` | yes - asserts 0 or 1,000 and no writer error; the write runs between backup steps, so lock contention during a step is not exercised (the app's default 5 s busy timeout covers it) |
| C4 | `backup.service.test.ts` `AC4 two backups 1 ms apart create two files`; `AC4 a backup whose name exists fails and keeps the existing file` | yes |
| C5 | `backup.service.test.ts` `AC5 prunes the oldest beyond BACKUP_KEEP counting pre-restore backups`; `AC5 keeps every backup while under BACKUP_KEEP`; `AC5 never touches files that are not backups` | yes |
| C6 | `backup.service.test.ts` `AC6 parses BACKUP_KEEP`; `backup.integration.test.ts` `AC6 backup command rejects an invalid BACKUP_KEEP before writing anything` | yes |
| C7 | `backup.service.test.ts` `AC7 a failed copy removes the partial file and deletes no backup`; `backup.integration.test.ts` `AC7 backup command fails when the backup folder is missing`; `AC7 backup command fails when the database file is missing and creates none` | yes - for the three cases the check names; the plan's AC 7 example "folder not writable" has no test (see Findings) |
| C8 | `backup.integration.test.ts` `AC8 restore brings back a deleted category and saves the current data first` | yes - the pre-restore backup holding `Leisure` proves the save came before the replace |
| C9 | `backup.integration.test.ts` `AC9 restoring the pre-restore backup undoes the restore` | yes |
| C10 | `backup.service.test.ts` `AC10 prunes only after the chosen backup is in place`; `backup.integration.test.ts` `AC10 restore with BACKUP_KEEP 1 keeps the restored data` | yes |
| C11 | `backup.service.test.ts` `AC11 rejects a missing or invalid backup name and changes nothing`; `backup.integration.test.ts` `AC11 restore command prints the failure and exits 1` | yes |
| C12 | `backup.service.test.ts` `AC12 a damaged backup is refused without a pre-restore backup`; `backup.integration.test.ts` `AC12 a text file named as a backup is refused` | yes |
| C13 | `backup.service.test.ts` `AC13 refuses a backup from a newer app version and accepts the same version`; `backup.integration.test.ts` `AC13 reads the newest migration from a backup and from the journal` | yes - boundary tested at newest+1 and equal |
| C14 | `backup.integration.test.ts` `AC14 an older backup restores and the migrate step brings it up to date` | yes |
| C15 | `backup.service.test.ts` `AC15 a failure after the checks leaves the database in place` | yes - on the three named steps (unit fakes; byte-for-byte is string equality on the fake); failures after the rename are not covered (see Findings) |
| C16 | `backup.integration.test.ts` `AC16 restore with no current data skips the pre-restore backup` | yes |
| C17 | `db-restore.test.ts` `AC17 db-restore.sh stops, restores and starts the app`; `AC17 db-restore.sh starts the app again when the restore fails`; `AC17 db-restore.sh needs a backup name` | yes - for a restore that exits; the script has no `trap`, so a signal leaves the app stopped and no test covers it (see Findings) |
| C18 | lone proof: `grep` of `docker-compose.yml` and `Dockerfile` (mount string, `BACKUP_DIR=/app/backups`, one `/app/backups` line) | yes - the diff puts the single mount under `capital-care-prd` |
| C19 | lone proof: `grep` of `docs/operations/backup-and-restore.md` for 8 words plus the two links | yes - the greps are loose (`1000`, `Copy` could match anywhere), but reading the doc shows every required topic |
| C20 | `backup.service.test.ts` `AC7 a backup folder that is not writable fails and deletes no backup` | added by the author for finding 4 after this review; green in `proofs.md` at HEAD, not judged by the Verifier |
| C21 | `backup.service.test.ts` `a pruning failure after a backup reports the backup with a warning`, `a pruning failure after a restore reports the restore with a warning` | added by the author for findings 1-2 after this review; green in `proofs.md` at HEAD, not judged by the Verifier |
| C22 | `backup.service.test.ts` `a journal file that cannot be removed fails the restore before the database is replaced` | added by the author for finding 1 after this review; green in `proofs.md` at HEAD, not judged by the Verifier |
| C23 | `db-restore.test.ts` `AC17 db-restore.sh starts the app again after SIGHUP/SIGTERM/SIGINT during the restore` | added by the author for finding 3 after this review; green in `proofs.md` at HEAD, not judged by the Verifier |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A failure after the database was replaced is reported as `Restore failed: ... Current data was not changed.` with exit `1`, while the data was in fact replaced; no test fails | `backup.service.ts` `restore()`: the sidecar removal and `this.prune()` run after `rename(staging, dbPath)` outside any try, and `runRestoreCommand` prints the AC 11 message for every error. Throwaway unit test: `remove` throws `EACCES` on the pruned file with `keep: 1` → `restore` rejects and the fake DB holds the chosen backup's data | Treat sidecar removal and pruning as best-effort after the rename (catch, warn, still return success), or report a distinct message; add a test where prune fails after the rename and assert exit `0` (or the distinct message) and the restored data || `97d2abb` - sidecar removal moved before the rename inside the try (C22); pruning after the rename returns a warning and the restore exits `0` (C21) |
| The same in `backup()`: a prune failure after the backup file was renamed into place prints `Backup failed` and exits `1`, though the backup exists | `backup.service.ts` `backup()` calls `this.prune()` after `copyDatabase`; throwaway test with `remove` throwing → `backup()` rejects and `capital-care-20261127T210500123Z.db` is in the folder | Same as above: do not fail a completed backup on a prune error; test it || `97d2abb` - a prune failure after a backup returns a warning and exits `0` (C21) |
| `db-restore.sh` has no `trap`, contrary to door 3 ("start ... under a `trap`, so the app always starts again"): a SIGHUP (SSH session dropped) or SIGTERM during the restore leaves `capital-care-prd` stopped | `scripts/db-restore.sh` runs `start` sequentially after `run`. Throwaway run with a fake `docker` whose `run` sleeps: `kill -HUP` → exit 129, log shows only `stop` and `run`, no `start`; same for `kill -TERM` (exit 143) | Start the app from a `trap ... EXIT` (and handle HUP/INT/TERM) set after a successful `stop`; add a test that signals the script mid-restore and asserts `start` was called || `97d2abb` - HUP/INT/TERM traps set after `stop`; the app is started after the foreground restore ends and the script exits 129/130/143 (C23) |
| AC 7's example "folder not writable → exit 1" is not proven; C7 substitutes "copy fails" on a fake engine | `checks.md` C7 and Coverage row "backup failures, AC 7 (3)" list copy fails / folder missing / database missing; no test makes `BACKUP_DIR` unwritable against the real adapter | Add an integration test with a read-only `BACKUP_DIR` (skip when running as root) asserting exit `1`, `Backup failed:`, no `.partial` left || `97d2abb` - unit test with the copy failing on `EACCES` (C20); not an integration test, because the container and CI runner may run as root, which ignores folder permissions |
