# Database Backup and Restore

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by tghcastro, 2026-11-27

## Situation

- Effort: in active construction. The app runs in production and holds the owner's real financial records.
- Decision: committed by tghcastro, 2026-11-26, in Linear [CAP-24](https://linear.app/tghcastro/issue/CAP-24/database-backup-and-restore) (High priority, milestone "Capital Care MVP"). The issue's open questions were answered by tghcastro on 2026-11-27.
- In flight: the project's database rules already require every backup to be a consistent copy; this PRD keeps that rule. Release policy (CAP-37) waits for this work and stays out.
- At stake: one-way. A single loss of the production data loses every financial record, and a restore that goes wrong can destroy data too.

## Problem

Construction. Production backups are not configured. If the data is lost or damaged, or the owner makes a mistake such as deleting a category, there is no way back. The owner has no substitute today: nothing is copied anywhere. This is the last piece the MVP needs before the owner can trust the app with real records, and release policy (CAP-37) cannot start until it exists.

Unmeasured: there has been no data loss yet. The decision rests on the cost of one loss (all records), not on how often it happens.

## Success

- Worked if: from the first release that includes it, the owner can take a backup in one step and, after a mistake, get the data back as it was at that backup, without help.
- Going wrong: a backup reports success but cannot be restored, or after a restore the app shows data that matches neither the backup nor the data from before.
- Review: the first time the owner restores in production, or at the MVP release, whichever comes first - tghcastro.

## Boundary

In: taking a backup by hand while the app is running; keeping a configurable number of backups, default 5, outside the app's data; restoring a chosen backup; undoing a restore; reporting failures; documenting the steps.

Out:
- Scheduled or automatic backups - the owner chose manual only (2026-11-27).
- Encryption - not needed while backups stay on the same machine. The documentation names it as a known limitation.
- Copying backups off the machine - the owner does this by hand for now.
- Backup or restore from the web app - it is a task the owner runs on the server, not a page of the app.

Unchanged:
- The app's pages and API behave as before. Taking a backup does not interrupt anyone using the app.
- The DEV environment keeps its throw-away data and has no backups.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Take a backup while the app is running | A complete, consistent copy is saved outside the app's data. The app keeps serving with no interruption. | A success message naming the new backup and its date and time |
| Take a backup while data is being changed | The backup holds the data as of one single moment, never half of a change. | The same success message |
| Several backups on the same day | Each backup is identified by its own date and time. None overwrites another. | Each backup with its own date and time |
| Backup when the kept number is already reached | The new backup is saved first. Only then is the oldest backup removed, so the kept number (default 5) is not exceeded, and a failed backup never removes an old one. | The new backup present; the oldest one gone |
| Backup fails (no space, folder missing, no permission) | Nothing half-written is left among the backups. Earlier backups and the app's data are untouched. | A clear error saying the backup failed and why |
| Restore a chosen backup | The current data is first saved as a pre-restore backup. The app stops briefly, the chosen backup replaces the data, and the app starts again. | A success message; the app shows the data as it was at that backup |
| Example: category deleted by mistake | Backup on 26 November. Category deleted on 27 November. Restoring the 26 November backup brings the category back; changes made after 26 November are lost. | The category is back |
| Undo a restore | The pre-restore backup is a normal backup, labelled as pre-restore, and counts toward the kept number. Restoring it brings back the data from just before the restore. | The data from before the first restore |
| Restore fails, the backup is damaged, or there is no backup to restore | The current data stays exactly as it was, and the app runs again with it. | A clear error saying the restore failed and why; the same data as before |
| Restore a backup made by an older version of the app | It restores, and the app brings the data up to date as it does on any upgrade. | The data as it was at that backup, in the current app |
| Restore a backup made by a newer version of the app | The restore is refused and the current data stays. | An error saying the backup comes from a newer version |
| Owner follows the documentation | The steps to take and restore a backup, set the kept number, and copy backups elsewhere are written down, with encryption named as a known limitation. | Documented steps |
