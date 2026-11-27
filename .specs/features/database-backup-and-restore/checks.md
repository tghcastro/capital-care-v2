# Database Backup and Restore checks

Build: `pnpm type-check`; `pnpm lint`; `pnpm build`
Run backup: `pnpm vitest run --project node modules/ledger/src/backup scripts/__test__ --reporter=verbose`
Plan: `.specs/features/database-backup-and-restore/plan.md`

19 checks in 3 slices · 3 one-way doors · 0 open

## Checks

### S1 - Take a backup while the app is running

**C1** - A backup started at 2026-11-27 21:05:00.123 UTC is written to `BACKUP_DIR` as `capital-care-20261127T210500123Z.db`; the backup command prints `Backup created: <name>` and exits `0` (AC 1)
Proof: run backup | ✓ AC1 names the backup from the UTC clock with milliseconds
Proof: run backup | ✓ AC1 backup command prints the name and exits 0

**C2** - A completed backup holds the same rows as the database and `PRAGMA integrity_check` on it returns `ok` (AC 2)
Proof: run backup | ✓ AC2 the backup holds the same rows and passes integrity_check

**C3** - A transaction inserting 1,000 rows that commits while a backup runs on another connection leaves 0 or 1,000 of those rows in the backup, and the writer is never refused (AC 3)
Proof: run backup | ✓ AC3 a write committed during the backup is all or nothing in it

**C4** - Two backups 1 ms apart create two files; a backup whose name already exists fails and leaves the existing file untouched (AC 4)
Proof: run backup | ✓ AC4 two backups 1 ms apart create two files
Proof: run backup | ✓ AC4 a backup whose name exists fails and keeps the existing file

**C5** - After a backup, backups beyond `BACKUP_KEEP` are deleted oldest first, pre-restore backups count, and files not matching door 2 stay: keep 5 with 5 existing → 5 remain and the oldest is gone; keep 5 with 3 existing → 4 remain; `notes.txt` stays (AC 5)
Proof: run backup | ✓ AC5 prunes the oldest beyond BACKUP_KEEP counting pre-restore backups
Proof: run backup | ✓ AC5 keeps every backup while under BACKUP_KEEP
Proof: run backup | ✓ AC5 never touches files that are not backups

**C6** - `BACKUP_KEEP` unset → 5, `"05"` → 5; `"0"`, `"-1"`, `"2.5"`, `"abc"` → the command exits `1` with `Backup failed: BACKUP_KEEP must be a whole number of at least 1, got "<value>"` and writes nothing (AC 6)
Proof: run backup | ✓ AC6 parses BACKUP_KEEP
Proof: run backup | ✓ AC6 backup command rejects an invalid BACKUP_KEEP before writing anything

**C7** - When the copy fails, when `BACKUP_DIR` is missing, or when the database file is missing, the `.partial` file is removed, no earlier backup is deleted, the database is unchanged, stderr reads `Backup failed: <reason>` and the exit code is `1` (AC 7)
Proof: run backup | ✓ AC7 a failed copy removes the partial file and deletes no backup
Proof: run backup | ✓ AC7 backup command fails when the backup folder is missing
Proof: run backup | ✓ AC7 backup command fails when the database file is missing and creates none

### S2 - Restore a chosen backup

**C8** - Restoring the 26 Nov backup after a category was deleted on 27 Nov saves the current data as `capital-care-<timestamp>-pre-restore.db`, brings the category back, drops rows created after the backup, prints `Restored <name>. Current data saved as <pre-restore name>.` and exits `0` (AC 8)
Proof: run backup | ✓ AC8 restore brings back a deleted category and saves the current data first

**C9** - Restoring the pre-restore backup brings back the data from just before the first restore (AC 9)
Proof: run backup | ✓ AC9 restoring the pre-restore backup undoes the restore

**C10** - Pruning runs after the chosen backup is in place: with `BACKUP_KEEP=1` and one backup, restoring it leaves its data in the database and only the pre-restore backup in the folder (AC 10)
Proof: run backup | ✓ AC10 prunes only after the chosen backup is in place
Proof: run backup | ✓ AC10 restore with BACKUP_KEEP 1 keeps the restored data

**C11** - A restore with no name, a name not matching door 2 (`../capital-care.db`, `notes.txt`) or a name with no file in `BACKUP_DIR` changes nothing, prints `Restore failed: <reason>. Current data was not changed.` and exits `1` (AC 11)
Proof: run backup | ✓ AC11 rejects a missing or invalid backup name and changes nothing
Proof: run backup | ✓ AC11 restore command prints the failure and exits 1

**C12** - A backup that fails `integrity_check`, and a text file under a backup name, are refused with no pre-restore backup created (AC 12)
Proof: run backup | ✓ AC12 a damaged backup is refused without a pre-restore backup
Proof: run backup | ✓ AC12 a text file named as a backup is refused

**C13** - A backup whose newest migration is later than the newest the app ships is refused with `the backup comes from a newer version of the app`; an equal one is restored; the newest migration is read from the backup's `__drizzle_migrations` and from the app's journal (AC 13)
Proof: run backup | ✓ AC13 refuses a backup from a newer app version and accepts the same version
Proof: run backup | ✓ AC13 reads the newest migration from a backup and from the journal

**C14** - A backup taken before migration `0003` restores, and the migrate step then brings it to all 4 migrations with `category.parentId` present (AC 14)
Proof: run backup | ✓ AC14 an older backup restores and the migrate step brings it up to date

**C15** - When the pre-restore backup, the copy, or the rename fails, the file at `DB_PATH` is not replaced and the restore fails with the AC 11 message (AC 15)
Proof: run backup | ✓ AC15 a failure after the checks leaves the database in place

**C16** - With no file at `DB_PATH`, the restore skips the pre-restore backup, puts the backup in place and prints `Restored <name>. There was no current data to save.` (AC 16)
Proof: run backup | ✓ AC16 restore with no current data skips the pre-restore backup

### S3 - Run it in production

**C17** - `scripts/db-restore.sh <name>` runs `stop capital-care-prd`, then `run --rm --no-deps --pull never capital-care-prd node dist/restore.js <name>`, then `start capital-care-prd` whether the restore succeeded or failed, and exits with the restore's code; with no name it exits `1` without stopping anything (AC 17)
Proof: run backup | ✓ AC17 db-restore.sh stops, restores and starts the app
Proof: run backup | ✓ AC17 db-restore.sh starts the app again when the restore fails
Proof: run backup | ✓ AC17 db-restore.sh needs a backup name

**C18** - `capital-care-prd` mounts `${BACKUP_HOST_DIR:-./backups}:/app/backups`, the image sets `BACKUP_DIR=/app/backups`, and `capital-care-dev` has no backups mount (AC 18)
Proof: `grep -q '\${BACKUP_HOST_DIR:-./backups}:/app/backups' docker-compose.yml && grep -q 'BACKUP_DIR=/app/backups' Dockerfile && [ "$(grep -c '/app/backups' docker-compose.yml)" = "1" ]`

**C19** - `docs/operations/backup-and-restore.md` covers taking, restoring and undoing, `BACKUP_KEEP`, `BACKUP_HOST_DIR`, UID 1000, copying elsewhere and the lack of encryption, and is linked from `README.md` and `database.md` (AC 19)
Proof: `f=docs/operations/backup-and-restore.md; for w in 'dist/backup.js' 'db-restore.sh' 'pre-restore' 'BACKUP_KEEP' 'BACKUP_HOST_DIR' '1000' 'Copy' 'not encrypted'; do grep -q -- "$w" "$f" || exit 1; done; grep -q 'operations/backup-and-restore.md' README.md && grep -q 'operations/backup-and-restore.md' docs/tech/definitions/database.md`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `backup.js` exit codes (2) | `0` C1 · `1` C6 C7 | - |
| `restore.js` exit codes (2) | `0` C8 · `1` C11 | - |
| `db-restore.sh` exit codes (2) | `0` C17 · `1` C17 | - |
| one-way doors (3) | 1 backups mount C18 · 2 file name C1 C11 · 3 host script C17 | - |
| name rule, AC 1 (1 example) | 2026-11-27 21:05:00.123 → `capital-care-20261127T210500123Z.db` C1 | - |
| pruning, AC 5 (4 examples) | 5 existing → 5 C5 · 3 existing → 4 C5 · `notes.txt` kept C5 · pre-restore counts C5 | - |
| `BACKUP_KEEP` values, AC 6 (6) | unset C6 · `05` C6 · `0` C6 · `-1` C6 · `2.5` C6 · `abc` C6 | - |
| backup failures, AC 7 (3) | copy fails C7 · folder missing C7 · database missing C7 | - |
| invalid restore names, AC 11 (4) | none C11 · `../capital-care.db` C11 · `notes.txt` C11 · no such file C11 | - |
| damaged backups, AC 12 (2) | integrity not ok C12 · text file C12 | - |
| version, AC 13 (2 examples) | newer → refused C13 · equal → restored C13 | - |
| failing restore steps, AC 15 (3) | pre-restore C15 · copy C15 · rename C15 | - |
| startup config: backup settings (2 entry points) | `backup.js` C1 C6 · `restore.js` C11 | - |

## Swept

- validation: C6, C11
- failure modes: C7, C15
- idempotency: C4
- authorization: n/a - no route; only someone with a shell on the Docker host can run the commands (plan Surface)
- concurrency: C3
- data lifecycle: C5, C10
- dependency failure: C7
- state transitions: C7, C10
- observability: n/a - no logging requirement; each command prints one result line (C1, C8, C11)

## Handoff

- **Settled mid-build:** none
- **Dispatched:** Verifier at `e7fa539`
- **Boundary:** none yet
- **Abandoned:** none
