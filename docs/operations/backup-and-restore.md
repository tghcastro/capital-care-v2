# Backup and Restore

How to back up the production database and put a backup back. Applies to the `prod` profile
(`capital-care-prd`). The DEV environment keeps no data and has no backups.

Product requirements: [`.prd/database-backup-and-restore.md`](../../.prd/database-backup-and-restore.md).
Plan: [`.specs/features/database-backup-and-restore/plan.md`](../../.specs/features/database-backup-and-restore/plan.md).

## How it works

- A backup is a complete, consistent copy of the database, made with SQLite's online backup while
  the app keeps running. Never copy the database file by hand.
- Backups go to a folder on the host, outside the `capital-care-data` volume. Deleting the
  volume does not delete them.
- Each backup is named after the UTC date and time it was taken, with milliseconds:
  `capital-care-20261127T210500123Z.db`. Names sort by time, so `ls` shows the oldest first.
- A restore first saves the current data as a backup ending in `-pre-restore.db`, for example
  `capital-care-20261127T213000000Z-pre-restore.db`, so a restore can be undone.
- Only the newest `BACKUP_KEEP` backups are kept (default 5), pre-restore backups included. The
  oldest are deleted after each backup or restore succeeds. Other files in the folder are never
  touched.

## Setup (once)

Create the backups folder next to `docker-compose.yml` and give it to UID 1000, the `node` user
the container runs as. If the folder is missing, Docker creates it owned by root and every backup
fails with a permission error.

```bash
mkdir -p backups
```

```bash
sudo chown 1000:1000 backups
```

Optional settings, in `.env` next to `docker-compose.yml`:

| Variable | Default | What it does |
| --- | --- | --- |
| `BACKUP_HOST_DIR` | `./backups` | Host folder mounted at `/app/backups` in `capital-care-prd` |
| `BACKUP_KEEP` | `5` | How many backups to keep, a whole number of at least 1 |

After changing `BACKUP_HOST_DIR`, recreate the container (`docker compose --profile prod up -d`).
A new `BACKUP_KEEP` applies from the next backup or restore.

## Take a backup

The app keeps running; nobody using it is interrupted.

```bash
docker compose --profile prod exec capital-care-prd node dist/backup.js
```

It prints `Backup created: capital-care-<timestamp>.db` and exits `0`. If old backups could not be
deleted afterwards, it also prints `Warning: could not delete old backups: <reason>`: the backup
itself is fine. If it fails it prints
`Backup failed: <reason>`, exits `1`, and leaves the data and the earlier backups as they were.

## Restore a backup

Restoring replaces all the current data with the backup. Changes made after the backup are lost,
but the current data is first saved as a pre-restore backup.

1. Find the backup:

   ```bash
   ls backups/
   ```

2. Restore it, from the folder that holds `docker-compose.yml`:

   ```bash
   scripts/db-restore.sh capital-care-20261126T120000000Z.db
   ```

The script stops `capital-care-prd` (the app is unavailable for a few seconds), restores in a
one-off container of the same image, and starts the app again, whether the restore worked or not,
and also when the terminal session drops or you press Ctrl-C during the restore.
When the app starts, it applies any database migration the backup is missing, so a backup from an
older version of the app comes back up to date.

On success it prints `Restored <name>. Current data saved as <pre-restore name>.` (or `There was no
current data to save.` when the database was missing). On failure it prints
`Restore failed: <reason>. Current data was not changed.` and exits `1`. A restore fails when:

- the name is missing, or is not a backup name, or there is no such file in the backups folder;
- the backup is damaged or is not a database;
- the backup comes from a newer version of the app than the one running.

## Undo a restore

Restore the pre-restore backup the restore printed:

```bash
scripts/db-restore.sh capital-care-20261127T213000000Z-pre-restore.db
```

## Copy backups elsewhere

Backups stay on the same machine as the data, so a lost disk loses both. Copy the backups folder
somewhere else regularly, for example to another disk or a cloud drive:

```bash
cp backups/capital-care-*.db /path/to/another/disk/
```

## Known limitations

- Backups are not encrypted. Anyone who can read the backups folder can read all the financial
  records. Keep the folder readable only by its owner, and encrypt any copy that leaves the
  machine.
- Backups are manual. There is no schedule.
