#!/usr/bin/env bash
# Restore a database backup into the production app (CAP-24).
#
# Usage: scripts/db-restore.sh <backup-file-name>
#
# Stops capital-care-prd, runs the restore in a one-off container of the same image (with the
# same volumes), then starts capital-care-prd again, whether the restore succeeded or not.
# Exits with the restore's exit code. See docs/operations/backup-and-restore.md.
set -u

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "Usage: scripts/db-restore.sh <backup-file-name>" >&2
  echo "Backups are in the host backups folder (BACKUP_HOST_DIR, default ./backups)." >&2
  exit 1
fi
name="$1"

cd "$(dirname "$0")/.." || exit 1

compose() {
  docker compose --profile prod "$@"
}

echo "Stopping capital-care-prd"
if ! compose stop capital-care-prd; then
  echo "Could not stop capital-care-prd. Nothing was restored." >&2
  exit 1
fi

compose run --rm --no-deps --pull never capital-care-prd node dist/restore.js "$name"
status=$?

echo "Starting capital-care-prd"
if ! compose start capital-care-prd; then
  echo "Could not start capital-care-prd. Start it with: docker compose --profile prod up -d" >&2
fi

exit "$status"
