# Transaction Details, Edit and Delete

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by tghcastro, 2026-11-25

## Situation

- Effort: in active construction - transactions can be recorded, settled, changed and stopped by a programmatic caller, and the web page lists them by month; the web page cannot open, change, delete or end one, and there are no notes.
- Decision: committed by tghcastro, 2026-11-25, in Linear issue CAP-9 (High priority, milestone "Capital Care MVP").
- In flight: the Transactions PRD (`.prd/transactions.md`) is the precedent for forecast, settled, recurring and instalment entries; where the two disagree, this PRD wins for what happens to a series when one of its occurrences is settled, changed or ended. Monthly Balance, Categories and Accounts are specified in their own PRDs and stay out.
- At stake: mostly cheap to undo - a personal tool with a single user. The one-way parts are deleting a one-off, ending a series, and the split caused by settling an occurrence, which undoing the settlement does not reverse.

## Problem

Construction. The Transactions PRD promised that the owner can fix entries, stop a series and see instalments, and it moved the instalment total to the web round. The web page now lists transactions, but the owner cannot open one to see all of it, correct a mistake, delete it, end a series, or see how much of a purchase in instalments is still left. There is also no place to keep longer context next to an entry. Until this exists, the web page is a read-only stand-in, and the cutover goal of the Transactions PRD (a full month run on this tool alone) cannot be met.

Unmeasured: nobody counts how often the owner corrects an entry or checks what is left on an instalment.

## Success

- Worked if: within a month of release, the owner corrects entries, ends series and checks what is left on instalments in the web page, without the API client or the old tool.
- Going wrong: the owner still opens the API client to change or delete an entry, or works out what is left by hand.
- Review: one month after release - tghcastro.

## Boundary

In: opening a transaction row to see its details; changing a transaction; deleting a one-off; ending a series from a chosen occurrence; totals for a series with an end; notes; how settling, changing and ending split a series. All of it in the web page.

Out: rebuilding a series after a settlement is undone - by decision, the split stays.
Out: totals that add up several pieces of a split series - each piece shows its own totals, and the owner looks at each.
Out: totals for a series with no end - by decision, none are shown.

Unchanged: Categories, Accounts and Monthly Balance; how a transaction is recorded; the settle and undo-settlement actions themselves (only what they do to a series is new).

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Open the details of a transaction | An icon on each row expands and collapses its details. | Date, description, amount, type, account, category, status, recurrence or instalment number, notes and, where they apply, the totals |
| Start editing | The expanded row has a button that opens the transaction for editing. | The edit form with the current values |
| Before saving a change | The owner is told whether the change applies to this occurrence only, or to this one and every later one. | Which rule applies, before saving |
| Change a forecast one-off | Any field can be changed. | The new values |
| Change a settled one-off | Any field can be changed. It stays settled. Undoing the settlement is a separate action that already exists. | The new values, still Settled |
| Change a forecast occurrence of a series | The change applies to this occurrence and every later one. The series splits: the earlier occurrences stay a series that ends just before this one, and this one and the later ones form a new series with the new values. | Earlier occurrences unchanged; this and later ones with the new values |
| Settle an occurrence of a series | That occurrence becomes a one-off: it leaves the series and shows no totals. The series splits around it. Example: series of instalments 7 to 12, settling 10 leaves a series 7 to 9, a one-off on 10 and a series 11 to 12. | The occurrence as Settled, with no totals |
| Change a settled occurrence | It is a one-off, so the change applies to it only. | Other occurrences unchanged |
| Undo the settlement of a former occurrence | It goes back to Forecast and stays a one-off. The series is not rebuilt. | A forecast one-off; the pieces of the series stay apart |
| Delete a one-off, forecast or settled | The owner confirms first, then it is removed. | Nothing on that day |
| End a series from a chosen occurrence | The owner confirms first. The chosen occurrence and every later one of that series are removed. Earlier occurrences stay. One-offs that were once occurrences of the series are not touched. Example: series 7 to 12, ending at 9 leaves the series 7 to 8. | Nothing from the chosen occurrence on, except former occurrences already settled |
| Totals of an occurrence of a series with an end | For the occurrence shown, with instalment number n, series amount a and last instalment N of that series: up to this instalment = n × a; total = N × a; left = total − up to this instalment. Settlements do not change these numbers. Example: instalment 10 of 100 at 20,00 shows 200,00 / 2000,00 / 1800,00; instalment 17 shows 340,00 / 2000,00 / 1660,00. | Up to this instalment, total and left |
| Totals after a split | Each piece is its own series with its own amount and last instalment. Example: instalment 10 of 100 at 20,00, and instalment 17 changed to 25,00: instalment 11 shows 220,00 / 320,00 / 100,00; instalment 17 shows 425,00 / 2500,00 / 2075,00. | Each piece's totals on its own; the owner looks at both pieces to know everything still owed |
| Totals of a series with no end | No totals. | No totals |
| Add notes | Notes are optional, accept several lines and hold up to 2000 characters. They are longer than the description. | The notes in the details |
| Notes in a series | Every occurrence of a series shows the same notes. Changing them on one occurrence changes them on all occurrences of that series, earlier ones included. Changing only the notes does not split the series. | The same notes on each occurrence |
| Notes after a split | Each piece keeps a copy of the notes. From then on they are independent: changing the notes on one piece does not change the others. | Each piece with its own notes |
| Move the date of a forecast occurrence of a series | It is a change like any other, so it applies to this occurrence and the later ones and splits the series. The moved occurrences keep their notes and their totals. | The occurrence on its new date, with the same notes and totals |

## Open questions

1. Whether a settled former instalment still shows its number (for example "17 of 48") - default taken: yes, as a label only, as in the Transactions acceptance tests; it shows no totals and is not part of any series.
2. Totals after a series is ended - default taken: the rule above applies unchanged, so N is the last instalment that still exists. Example: series 7 to 12 at 300,00 ended at 9, instalment 7 shows 2100,00 / 2400,00 / 300,00, while its label still reads "7 of 12".
3. Changing the notes together with another field of a forecast occurrence of a series - default taken: the series splits as for any change; the new piece gets the new notes and the earlier piece keeps the old ones.
