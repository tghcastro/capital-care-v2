# Monthly Balance checks

Build: `pnpm type-check`; `pnpm lint`; `pnpm build`
Run node: `npx vitest run --project node --reporter=verbose`
Run web: `npx vitest run --project web --reporter=verbose`
Plan: `.specs/features/monthly-balance/plan.md`

26 checks in 5 slices · 2 one-way doors · 0 open

The acceptance tests follow the PRD's Gherkin scenarios one month at a time: each Examples row and each scenario is its own test in `apps/api/test/monthly-balance.component.test.ts`, which seeds the PRD background through the real API on a disposable database. Expected values are written as the PRD writes them (`2,321.00`) and compared with the API's canonical decimal strings. Test titles carry `MB<n>`, the number of the check they prove.

## Checks

### S1 - Balances carry over between months with no filter

**C1** - With no filter, `GET /transactions/balance` returns each month's `totals.net` and `totals.finalBalance` as in the PRD, one test per month (AC 1, door 1)
Proof: run node | ✓ Monthly balance without filters > MB1 October 2026 has net 0.00 and final 0.00
Proof: run node | ✓ Monthly balance without filters > MB1 November 2026 has net 2,321.00 and final 2,321.00
Proof: run node | ✓ Monthly balance without filters > MB1 December 2026 has net 2,320.00 and final 4,641.00
Proof: run node | ✓ Monthly balance without filters > MB1 January 2027 has net 2,890.00 and final 7,531.00
Proof: run node | ✓ Monthly balance without filters > MB1 February 2027 has net 0.00 and final 7,531.00
Proof: run node | ✓ Monthly balance without filters > MB1 March 2027 has net 3,000.00 and final 10,531.00
Proof: run node | ✓ Monthly balance without filters > MB1 April 2027 has net 0.00 and final 10,531.00

**C2** - The opening balance counts every earlier occurrence of the caller, settled and forecast, with recurring entries expanded and stopped occurrences left out (AC 1)
Proof: run node | ✓ TransactionService balance > MB2 settled and forecast occurrences both count
Proof: run node | ✓ TransactionService balance > MB2 a monthly receipt of 100.00 from 2026-01-15 opens April 2026 at 300.00
Proof: run node | ✓ TransactionService balance > MB2 the same receipt stopped from 2026-03-15 opens April 2026 at 200.00
Proof: run node | ✓ TransactionService balance > MB2 another user's transactions never count

**C3** - With no filter, `days` holds one ascending entry per date with occurrences, each the opening balance plus everything up to that date, one test per PRD scenario (AC 2)
Proof: run node | ✓ Monthly balance without filters > MB3 November 2026 day balances start from 0.00
Proof: run node | ✓ Monthly balance without filters > MB3 December 2026 day balances continue from the November closing balance
Proof: run node | ✓ Monthly balance without filters > MB3 January 2027 shows one balance per day after all of its transactions
Proof: run node | ✓ Monthly balance without filters > MB3 March 2027 day balances continue from the February closing balance

**C4** - The page shows each day's "Balance <value>" and the "Monthly net total" and "Final available balance" from `GET /transactions/balance`, in the standard money format (AC 1, AC 2)
Proof: run web | ✓ TransactionsPage monthly balance > MB4 shows the day balances and the summary the balance route returns

**C5** - An empty month returns `days: []` and the previous month's final balance; the page shows "No transactions this month", net `0.00` and that final balance (AC 3)
Proof: run node | ✓ Monthly balance without filters > MB5 February 2027 lists nothing and carries 7,531.00 forward to March
Proof: run web | ✓ TransactionsPage monthly balance > MB5 an empty month shows No transactions this month with net 0.00 and the carried final balance

### S2 - An account filter scopes balances, still carrying over

**C6** - With `account=<Checking Account>`, each month's net and final balance are as in the PRD, one test per month (AC 4)
Proof: run node | ✓ Monthly balance for Checking Account > MB6 November 2026 has net 2,550.00 and final 2,550.00
Proof: run node | ✓ Monthly balance for Checking Account > MB6 December 2026 has net 2,430.00 and final 4,980.00
Proof: run node | ✓ Monthly balance for Checking Account > MB6 January 2027 has net 3,300.00 and final 8,280.00
Proof: run node | ✓ Monthly balance for Checking Account > MB6 February 2027 has net 0.00 and final 8,280.00

**C7** - With `account=<Checking Account>`, January 2027 lists only Checking Account rows and its day balances are 8,980.00, 8,480.00, 8,280.00 (AC 4)
Proof: run node | ✓ Monthly balance for Checking Account > MB7 January 2027 lists only Checking Account and continues from its closing balance

**C8** - Several `account` params add up (Checking Account and Credit Card in January 2027 → final 7,531.00), and `account=none` selects occurrences with no account, opening balance included (AC 4)
Proof: run node | ✓ Monthly balance for Checking Account > MB8 both accounts together in January 2027 have final 7,531.00
Proof: run node | ✓ TransactionService balance > MB8 account none counts only occurrences with no account, opening balance included

**C9** - The page sends `month` alone when nothing is selected, and one `category` / `account` param per selected id (`none` for "Uncategorized" / "Unassigned") to both routes, listing only what the API returns (AC 5, door 1)
Proof: run web | ✓ TransactionsPage monthly balance > MB9 sends only the month when no filter is selected
Proof: run web | ✓ TransactionsPage monthly balance > MB9 sends one category and account param per selected id and none for the pseudo-entries
Proof: run web | ✓ TransactionsPage monthly balance > MB9 lists only the occurrences the API returns for the selected filters

### S3 - A category filter covers the selected month only and hides the summary

**C10** - With `category=<Shopping>`, January 2027 lists Winter jacket and Running shoes, day balances -180.00 and -330.00, and `totals` is `null` (AC 6, AC 7)
Proof: run node | ✓ Monthly balance with a category filter > MB10 Shopping in January 2027 starts at 0.00 and returns no totals

**C11** - With `category=<Groceries>&account=<Checking Account>`, January 2027 lists only Supermarket 2027-01-12, day balance -200.00, and `totals` is `null` (AC 6, AC 7)
Proof: run node | ✓ Monthly balance with a category filter > MB11 Groceries and Checking Account in January 2027 follow the category rule

**C12** - While a category is selected the page shows none of "Total received", "Total debits", "Monthly net total", "Final available balance", and shows them again when the last category is deselected (AC 7)
Proof: run web | ✓ TransactionsPage monthly balance > MB12 hides the four totals while a category is selected and shows them again after deselecting it

**C13** - `GET /transactions` filters occurrences by `category` and `account`: any of the ids within one param, both params together, `none` matching a null reference, another user's id matching nothing (AC 4, AC 6)
Proof: run node | ✓ TransactionService balance > MB13 listMonth matches any selected id within a param and both params together
Proof: run node | ✓ TransactionService balance > MB13 category none and account none match null references and another user's ids match nothing

### S4 - Changing a past transaction updates every later balance

**C14** - Editing Dentist 2026-12-05 to 220.00 gives December 2026 final 4,541.00, January 2027 final 7,431.00 and 2027-01-01 balance 8,541.00 (AC 8)
Proof: run node | ✓ Monthly balance after changing a past transaction > MB14 editing the amount of Dentist

**C15** - Deleting New office chair 2026-11-10 gives finals 2,550.00, 4,870.00 and 7,760.00 for November, December and January (AC 9)
Proof: run node | ✓ Monthly balance after changing a past transaction > MB15 deleting New office chair

**C16** - PATCH `date` moves a one-off to the new date with the same `transactionId`, values and settlement; Condo fees 2026-12-15 → 2027-01-02 gives December net 2,770.00 / final 5,091.00 and January net 2,440.00 / final 7,531.00 (AC 10, door 2)
Proof: run node | ✓ Monthly balance after changing a past transaction > MB16 moving Condo fees to the next month
Proof: run node | ✓ TransactionService move > MB16 moving a one-off keeps its id values and settlement

**C17** - Moving Wireless keyboard 2026-12-10 to Checking Account gives Checking Account finals 4,870.00 for December and 8,170.00 for January (AC 11)
Proof: run node | ✓ Monthly balance after changing a past transaction > MB17 moving Wireless keyboard to Checking Account

### S5 - Moving a recurring occurrence shifts the series

**C18** - Moving the forecast 2027-03-10 of a monthly 100.00 from 2027-01-10 (Jan 10 settled) to 2027-03-20 leaves Jan 10 settled and Feb 10 in the old series, and puts Mar 20 and Apr 20 in a new series with a new `transactionId`; nothing on Mar 10 or Apr 10 (AC 12, door 2)
Proof: run node | ✓ TransactionService move > MB18 moving a monthly occurrence shifts it and every later one

**C19** - Moving the 4/6 instalment on 2027-02-10 to 2027-02-25 gives 3/6 on Jan 10, 4/6 Feb 25, 5/6 Mar 25, 6/6 Apr 25, nothing after (AC 12)
Proof: run node | ✓ TransactionService move > MB19 moving an instalment keeps the numbering and the total

**C20** - Moving the first occurrence of a monthly entry moves the whole series (AC 12)
Proof: run node | ✓ TransactionService move > MB20 moving the first occurrence moves the whole series

**C21** - Moving a settled occurrence of a series, or one with a later settled occurrence, answers 409 with a `detail` naming the reason and changes nothing (AC 13)
Proof: run node | ✓ TransactionService move > MB21 moving a settled occurrence of a series is refused and changes nothing
Proof: run node | ✓ TransactionService move > MB21 moving an occurrence with a later settled one is refused and changes nothing
Proof: run node | ✓ transaction routes (HTTP) > MB21 PATCH date on a settled series occurrence answers 409

**C22** - A `date` that is not a real `YYYY-MM-DD` answers 400 with the shared date message and changes nothing; a `date` equal to the current one moves nothing (AC 14)
Proof: run node | ✓ transaction schemas > MB22 the edit date accepts real YYYY-MM-DD dates only
Proof: run node | ✓ transaction routes (HTTP) > MB22 PATCH with an invalid date answers 400 and changes nothing
Proof: run node | ✓ TransactionService move > MB22 a date equal to the current one moves nothing

**C23** - A series shift is one database transaction: if creating the new series fails, the old series is not stopped (door 2)
Proof: run node | ✓ TransactionRepository (real SQLite) > MB23 a failed series shift leaves the old series unchanged

### Surface

**C24** - `GET /transactions/balance` answers 400 for a bad month and 401 without a user id; `GET /transactions` with filters answers 200, 400 for a bad month and 401 without a user id (Surface)
Proof: run node | ✓ transaction routes (HTTP) > MB24 GET balance answers 400 for a bad month and 401 without a user id
Proof: run node | ✓ transaction routes (HTTP) > MB24 GET transactions with category and account params answers 200 with the matching occurrences
Proof: run node | ✓ transaction routes (HTTP) > C14 GET with a bad month returns 400
Proof: run node | ✓ transaction routes (HTTP) > C49 every route returns 401 without a user id

**C25** - PATCH with `date` answers 404 for another user's transaction and 401 without a user id, changing nothing (Surface)
Proof: run node | ✓ transaction routes (HTTP) > MB25 PATCH date answers 404 for another user's transaction and 401 without a user id

**C26** - IF `GET /transactions/balance` fails THEN the page shows the API `detail` with "Try again", which requests it again (sweep: dependency failure)
Proof: run web | ✓ TransactionsPage monthly balance > MB26 shows the API detail when the balance request fails and Try again refetches

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| PRD months without filters (7) | Oct 2026 C1 · Nov 2026 C1 · Dec 2026 C1 · Jan 2027 C1 · Feb 2027 C1 · Mar 2027 C1 · Apr 2027 C1 | - |
| PRD day-balance scenarios without filters (4) | Nov 2026 C3 · Dec 2026 C3 · Jan 2027 C3 · Mar 2027 C3 (and C5) | - |
| PRD months for Checking Account (4) | Nov 2026 C6 · Dec 2026 C6 · Jan 2027 C6 · Feb 2027 C6 | - |
| PRD account and category scenarios (3) | Checking Account January C7 · Shopping January C10 · Groceries + Checking Account January C11 | - |
| PRD change scenarios (4) | edit amount C14 · delete C15 · move date C16 · move account C17 | - |
| AC 1 opening examples (5) | PRD January C1 · first month ever C1 · monthly 300.00 C2 · stopped 200.00 C2 · another user C2 | - |
| occurrence kinds in the opening (4) | settled C2 · forecast C2 · recurring expanded C2 · stopped C2 | - |
| filter params sent by the page (6) | nothing selected C9 · one category C9 · one account C9 · several ids C9 · `category=none` C9 · `account=none` C9 | - |
| filter matching in the API (5) | OR within a param C13 · AND between params C13 · `none` category C13 · `none` account C8 C13 · another user's id C13 | - |
| summary totals hidden by a category filter (4) | Total received C12 · Total debits C12 · Monthly net total C12 · Final available balance C12 | - |
| date move outcomes, door 2 (6) | one-off C16 · monthly shift C18 · instalment shift C19 · first occurrence C20 · settled → 409 C21 · invalid → 400 C22 | - |
| `GET /transactions/balance` statuses (3) | 200 C1 · 400 C24 · 401 C24 | - |
| `GET /transactions` statuses (3) | 200 C24 · 400 C24 · 401 C24 | - |
| `PATCH /transactions/:id/occurrences/:date` statuses (5) | 200 C16 · 400 C22 · 404 C25 · 409 C21 · 401 C25 | - |
| client functions, door 1 (2) | `listMonth(month, filters)` C9 · `getBalance(month, filters)` C4 C9 | - |

## Swept

- validation: C22, C24
- failure modes: C23
- idempotency: n/a - PATCH addresses an occurrence by its date; repeating a move on the old date finds no occurrence there and answers 404 (the existing transactions test "a date that is not an occurrence returns 404"), so a retry cannot move twice
- authorization: C2, C13, C25
- concurrency: n/a - one Node process over synchronous better-sqlite3 calls; each request's reads and writes run to completion before the next, and the shift is one database transaction (C23)
- data lifecycle: C16 (values and settlement survive a move); nothing stored changes shape
- dependency failure: C26
- state transitions: C21 (settled occurrences of a series cannot move)
- observability: n/a - no logging requirement in this feature

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none
- **Boundary:** none closed
- **Abandoned:** none
