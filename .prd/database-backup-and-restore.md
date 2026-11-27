# Database Backup and Restore

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: draft

## Situation

- Effort: in active construction. The app runs in production and holds the owner's real financial records.
- Decision: committed by tghcastro, 2026-11-26, in Linear [CAP-24](https://linear.app/tghcastro/issue/CAP-24/database-backup-and-restore) (High priority, milestone "Capital Care MVP"). The open questions in the issue were answered by tghcastro on 2026-11-27.
- In flight: this follows the existing rule in the technical definitions that backups must be consistent copies, never a copy of the live data file. Release policy (CAP-37) waits for this and stays out.
- At stake: one-way for the owner. Without a backup, losing or damaging the production data loses every financial record for good. A restore that goes wrong can also destroy data, so restore must be undoable.

## Problem

Construction. Production backups are not configured. If the data is lost or damaged, or the owner makes a mistake such as deleting a category, there is no way back. The owner has no substitute today: nothing is copied anywhere. This is the last piece the MVP needs before the owner can trust the app with real records, and release policy (CAP-37) is blocked until it exists.

Unmeasured: there has been no data loss yet. The decision rests on the cost of a single loss (all records), not on how often it happens.

## Success

- Worked if: from the first release that includes it, the owner can take a backup in one step and, after a mistake, get the data back as it was at that backup, without help.
- Going wrong: a backup reports success but cannot be restored, or a restore leaves the app showing data that matches neither the backup nor the previous state.
- Review: the first time the owner restores in production, or at the MVP release - tghcastro.

## Boundary

In: taking a backup by hand while the app is running; keeping a configurable number of backups (default 5) outside the app's data; restoring a chosen backup; undoing a restore; reporting failures; documenting the steps.

Out:
- Scheduled or automatic backups - the owner chose manual only for now.
- Encryption - not needed while backups stay on the same machine. Recorded as a known limitation in the documentation.
- Copying backups off the machine (cloud storage, another disk) - the owner's job for now.
- Backup or restore from the web app - this is an operator task, not a feature of the app's pages.
- Restoring part of the data (one account, one category) - a restore is always all or nothing.

Unchanged:
- The app's pages and API behave as before. Taking a backup does not interrupt anyone using the app.
- The DEV environment keeps its throw-away data and is not backed up.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Take a backup while the app is running | A complete, consistent copy is saved outside the app's data. The app keeps serving with no interruption. | A success message naming the new backup and its date and time |
| Take a backup while someone is changing data | The backup holds the data as of one single moment: never half of a change. | The same success message |
| Several backups on the same day | Each backup has its own name with date and time. None overwrites another. | All backups listed, newest first |
| Backup when the kept number is already reached | The new backup is saved first. Only then is the oldest backup removed, so the kept number (default 5) is never exceeded and never drops below it because of a failure. | The new backup listed; the oldest one gone |
| Kept number changed by the owner | The next backup keeps the new number of backups. | That many backups after the next backup |
| Backup fails (no space, folder missing, no permission) | Nothing is half-written in the backups list. Earlier backups and the app's data are untouched. | A clear error saying the backup failed and why |
| No backups yet | Restore offers nothing to restore and changes nothing. | A message saying there are no backups |
| List backups | Every kept backup is shown with its date and time. | The list, newest first |
| Restore a chosen backup | The current data is first saved as a pre-restore backup. The app is stopped briefly, the chosen backup replaces the data, and the app starts again. | A success message; the app shows the data as it was at that backup |
| Example: category deleted by mistake | Backup on 26 November. Category deleted on 27 November. Restoring the 26 November backup brings the category back; changes made after 26 November are lost. | The category is back |
| Undo a restore | The pre-restore backup is a normal backup in the list, labelled as pre-restore. Restoring it brings back the data from just before the restore. It counts toward the kept number. | The pre-restore backup in the list; after restoring it, the data from before the first restore |
| Restore fails or the backup is damaged | The current data stays exactly as it was, and the app starts again with it. | A clear error saying the restore failed and why; the app shows the same data as before |
| Restore a backup made by an older version of the app | It restores, and the app brings the data up to date as it does on any upgrade. | The data as it was, in the current app |
| Restore a backup made by a newer version of the app | The restore is refused and the current data stays. | An error saying the backup is from a newer version |
| Owner follows the documentation | The steps to take, list and restore backups, change the kept number, and copy backups elsewhere are written down. | Documented steps |
