# Transactions verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at d30f761
**Verifier**: independent sub-agent (author != verifier)

Test files: `S` = `modules/ledger/src/transaction/__test__/transaction.service.test.ts`, `D` = `transaction.dto.test.ts`, `H` = `transaction.schedule.test.ts`, `R` = `transaction.router.test.ts`, `P` = `transaction.repository.test.ts`, `A` = `apps/api/test/transactions.component.test.ts`.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `R` `C1 POST /transactions returns 201 with the transaction fields and a canonical amount` | yes (the response for a recurrence or an instalment is not asserted here; see findings) |
| C2 | `S` `C2 a new transaction is a forecast even with a past date` | yes |
| C3 | `D` `C3 type rule accepts receipt and debit only` | no - schema only: the `400` status and "nothing saved" are never asserted over POST; `"Debit"` and `"expense"` run on `transactionTypeSchema`, not on the create schema the route uses |
| C4 | `D` `C4 amount rule accepts positive decimals within the bounds only`; `R` `C4 PATCH and settlement reject an invalid amount with 400 and change nothing` | no - POST `400` for a bad amount never asserted at a route (schema only); `"12.1234"` and the 12-digit value are accepted in `D` only, never through PATCH or settlement |
| C5 | `D` `C5 description is trimmed and limited to 1 to 100 characters` | no - the claim says POST and PATCH; PATCH's `descriptionSchema.optional()` and its `400` are never run, and no route test sees the `400` |
| C6 | `D` `C6 date rule accepts real YYYY-MM-DD dates only` | yes |
| C7 | `S` `C7 category and account must exist and belong to the caller`; `R` `C7 POST and PATCH answer 400 naming the field for a bad reference` | yes |
| C8 | `D` `C8 recurrence and instalment are exclusive and recurrence is one of four values` | yes (schema level; `400` over HTTP not asserted, acceptable for a pure rule) |
| C9 | `R` `C9 fields outside the contract are ignored` | yes |
| C10 | `S` `C10 a month lists its first to last day and nothing outside` | yes (mock repository, one-offs only; the real SQL range filter is exercised only by other checks) |
| C11 | `S` `C11 an empty month returns an empty list` | no - asserts `[]` from the service; the `200 { "occurrences": [] }` envelope for an empty month is never asserted at HTTP |
| C12 | `S` `C12 past forecasts are listed together with settled entries` | yes |
| C13 | `S` `C13 month occurrences are ordered by date then description ignoring case` | no - the `transactionId` tie-break is never exercised (two occurrences with equal date and description); the test passes with that key removed |
| C14 | `D` `C14 month rule accepts YYYY-MM only`; `R` `C14 GET with a bad month returns 400` | yes |
| C15 | `S` `C15 an occurrence carries all fields with the values in force on its date` | yes |
| C16 | `H` `C16 a one-off has a single occurrence on its date` | yes |
| C17 | `H` `C17 daily occurrences start on the start date and never end` | yes |
| C18 | `H` `C18 weekly occurrences fall every seven days` | yes (the month-boundary case is the one the plan names; my own cases below hold) |
| C19 | `H` `C19 monthly occurrences fall on the start day with no end` | yes |
| C20 | `H` `C20 monthly occurrences clamp to the last day and return to the start day` | yes |
| C21 | `H` `C21 annual occurrences fall once a year and clamp 29 February` | yes |
| C22 | `H` `C22 an instalment part way through numbers its occurrences and stops at the total` | no - the claim says each occurrence carries `recurrence: null` and `instalment: {number,total}`; this test passes a spec with `recurrence: 'monthly'` and asserts dates and numbers only. `recurrence: null` on an instalment is asserted only in C39 (one occurrence) |
| C23 | `H` `C23 an instalment from number 1 ends at the total` | yes |
| C24 | `D` `C24 instalment rule accepts whole numbers with number within total and total up to 999` | yes |
| C25 | `S` `C25 occurrences in different months share the transaction id` | yes |
| C26 | `S` `C26 settling a forecast occurrence marks it settled and keeps its amount` | no - asserts the service return; the HTTP `200` of PUT is never asserted (C55 reads only the body) |
| C27 | `S` `C27 a real paid amount applies to that occurrence only` | yes |
| C28 | `S` `C28 settling twice returns 409 and changes nothing` | no - asserts `ConflictError` at the service; the `409` status and the `ConflictError` mapping in the router are asserted nowhere |
| C29 | `S` `C29 undoing a settlement restores the forecast and a forecast cannot be undone` | no - same: `ConflictError` only, no `409` over HTTP, no `200` for the undo; the "drops edits made on the settled occurrence" assumption is never tested |
| C30 | `S` `C30 nothing is settled automatically` | yes |
| C31 | `R` `C31 a date that is not an occurrence returns 404 for settle edit and delete` | yes |
| C32 | `S` `C32 a forecast edit applies from that occurrence onward` | yes |
| C33 | `S` `C33 an edit does not change later settled occurrences` | yes |
| C34 | `S` `C34 editing a settled occurrence changes only it` | yes |
| C35 | `S` `C35 an earlier edit replaces a later planned edit` | yes |
| C36 | `S` `C36 editing the first occurrence changes the whole series` | yes |
| C37 | `S` `C37 editing a one-off changes the entry` | yes |
| C38 | `R` `C38 an empty edit returns 400 and schedule fields are ignored` | yes |
| C39 | `S` `C39 an edit keeps instalment numbering` | yes |
| C40 | `S` `C40 stopping removes the occurrence and all later ones and keeps earlier ones` | no - runs on the in-memory mock, so the real `stopDate` filter and the real repository `stopFrom` are never read back through a listing; the `204` is never asserted anywhere |
| C41 | `S` `C41 stopping from the first occurrence removes the transaction` | yes (mock; cascade is C52) |
| C42 | `S` `C42 a removed occurrence is gone` | no - asserts `NotFoundError` at the service; `404` over HTTP for a stopped date not asserted (C31 uses never-valid dates) |
| C43 | `S` `C43 stopping an instalment removes it from the chosen occurrence` | yes |
| C44 | `S` `C44 a past occurrence can be deleted` | yes |
| C45 | `A` `C45 deleting a used category keeps the transactions with a null category` | yes |
| C46 | `A` `C46 deleting a used account keeps the transactions with a null account` | yes |
| C47 | `A` `C47 only occurrences that used the deleted category lose it` | yes |
| C48 | `A` `C48 editing a description keeps a null category` | yes |
| C49 | `R` `C49 every route returns 401 without a user id` | yes |
| C50 | `R` `C50 another user's or unknown transaction returns 404 and changes nothing` | yes |
| C51 | `S` `C51 the month lists only the caller transactions` | no - runs on the mock repository, whose `userId` filter is a copy of the rule; the real SQL `eq(userId)` in `listBundlesInRange` is never run with two users' data (C50 creates data for Bob only) |
| C52 | `P` `C52 the migrations create the three tables with their keys and cascade` | yes |
| C53 | `P` `C53 calendar dates are stored as YYYY-MM-DD text` | yes |
| C54 | `P` `C54 deleting a category or account nulls the references in the database` | yes |
| C55 | `A` `C55 the app serves the transaction contract under /transactions` | yes (asserts keys, string amount, mount path; no status for PUT) |
| C56 | `P` `C56 a multi-row write rolls back as a whole` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| The `409` of settle and undo, and the `204` of stop, are asserted by no test; a controller that mapped `ConflictError` to 500 or returned `200` for stop would stay green | C28 and C29 (`transaction.service.test.ts`) assert `toThrow(ConflictError)`; a `grep` for 409 or 204 finds no status check in `transaction.router.test.ts`; C40 never calls the route. I ran the real stack: PUT twice gives 409, undo of a forecast gives 409, DELETE gives 204 - so the code is right, the test is not | add a router test for PUT twice (`409`), DELETE settlement on a forecast (`409`), the `200` of both, and DELETE occurrence (`204`) | 3aea911 - C26, C28, C29, C40 over HTTP |
| C51's user filter and C40's stop are proven only on the in-memory mock | `transaction.service.test.ts` C40, C51 use `InMemoryTransactionRepository`; `listBundlesInRange` in `transaction.repository.ts` (`eq(userId)`, `stopDate > from`, settlement range) runs under no test with two users or after a stop. My own real-SQLite run of both (user `b` sees `[]`; daily stopped at `2026-12-03` lists `12-01`,`12-02`; stop at the 1st of a month) was correct | repeat C51 and a stop-then-list (including a settlement dated after the stop and a stop on the 1st of a month) over the router or repository with real SQLite | 3aea911 - C40 and C51 over real SQLite |
| Several validation checks prove the schema, not the route: no test sees `400` from POST for a bad type, amount, description or date, nor from PATCH for a bad description | C3, C4 (POST half), C5, C6 in `transaction.dto.test.ts`; `transaction.router.test.ts` posts only bad references, an empty PATCH and bad PATCH/PUT amounts | add route tests for POST `400` and "nothing saved" per rule (one value each is enough), and PATCH with an empty and a 101-character description | 3aea911 - C3, C4, C5, C6 over the route |
| C13 never exercises the `transactionId` tie-break | `transaction.service.test.ts` C13 uses three distinct dates or descriptions; deleting the third sort key keeps it green | add two transactions with the same date and the same description (also differing only by case) and assert the id order | 3aea911 - C13 tie-break |
| C22 does not hold `recurrence: null` on instalment occurrences, and the instalment `POST` response is asserted nowhere | `transaction.schedule.test.ts` C22 checks dates and numbers on a spec built with `recurrence: 'monthly'`; no test asserts a created instalment's `recurrence`/`instalment`. My run returned `recurrence: null, instalment: {number:1,total:6}` correctly for the create body and `instalment.number` for each occurrence | assert `recurrence: null` and the `{number,total}` of every occurrence of an instalment in a listing, and of the POST response | 3aea911 - C22 recurrence null and POST response |
| C11, C26 and C29 do not assert the HTTP envelope or status they claim | C11 asserts `[]` from `listMonth`; `GET` of an empty month is never called in `transaction.router.test.ts` | assert `200` and `{ occurrences: [] }` over the router for an empty month; assert `200` on PUT and on DELETE settlement | 3aea911 - C11, C26, C29 over HTTP |
| "Undo drops edits made on the settled occurrence" (plan assumption, `Confirmed: n`) has no check | `transaction.service.test.ts` C29 undoes an unedited settlement only. Mine: edit Dec to 25, settle, PATCH the settled Dec to 26 and a new description, undo - Dec returns to 25 and the old description, as the plan says | add a check: settle, edit the settled occurrence, undo, assert the schedule's values | 3aea911 - C57 |
| Dates in years 0000-0099 break the schedule (low) | `Date.UTC` maps years 0-99 to 1900-1999 in `daysInMonth` and `dayNumber` (`transaction.schedule.ts`). My run: `isValidDate('0000-02-29')` is `false` (year 0 is a leap year), and weekly from `0099-12-25` lists `[]` for `0100-01` (should be `01-01`, `01-08`, `01-15`, `01-22`, `01-29`). `monthSchema` and `dateSchema` accept these years | build the dates with `setUTCFullYear` or reject years below 1000 in `dateSchema` and `monthSchema` and say so in plan S1.6 | 3aea911 - C60, plain calendar arithmetic |
| Amount with leading zeros is judged on the written length (low, plan ambiguous) | `"0000000000005"` returns `400` while `"000000000005"` returns `201` with `"5"`; plan S1.4 says "at most 12 integer digits" and the checks name neither | decide in the plan whether the digit count is of the written or the canonical value, then add the example to C4 | 3aea911 - C61, plan Assumptions row added |
| Rules the plan states that no check names | the weekly series crossing a month, an instalment starting on the 29th-31st (clamped), an edit on a clamped date (`2026-02-28` of a series from `01-31`), a stop at the first of a month, a settlement dated after a stop, and a settlement on a clamped date. I ran each over real SQLite and all held | add one check each, as listed under finding 2 | 3aea911 - C58, C59 |

## Probes run (throwaway, deleted)

All over the router with real SQLite unless noted; each held except the two low findings above.

- weekly from `2026-01-29`: `2026-02` gives `05,12,19,26`; `2026-03` gives `05,12,19,26`; `2027-01` gives `07,14,21,28`.
- instalment `{1,6}` from `2026-11-30`: `2026-12-30` is number 2, `2027-01-30` number 3, `2027-02-28` number 4; edit `2027-01-30` to `33` carries to `02-28`; stop at `2027-02-28` leaves `2027-01` and removes `02`; `2027-03-30` settle returns `404`.
- edit, settle, edit the settled one, undo (above).
- daily from `2026-11-29` with a settlement on `2026-12-10`, then stop at `2026-12-03`: `Dec` lists `01,02`, `2027-01` empty, the settlement route for `12-10` returns `404`; a second daily stopped at `2026-12-01` lists nothing in December.
- amounts `007.50` gives `7.5`; `000000000005` gives `5`; `0000000000005`, `0.00001`, `5.`, `.5`, `1e3`, ` 5`, `+5`, `00` are rejected; `0.0001` accepted.
- monthly from `2026-01-31`: edit on `2026-02-28` carries to `2026-03-31`; settle on `02-28` works, `02-31` returns `404`.
