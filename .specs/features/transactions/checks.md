# Transactions checks

Build: `pnpm type-check; pnpm lint; pnpm build`
Run unit: `pnpm exec vitest run modules/ledger/src/transaction apps/api/test --reporter=verbose 2>&1`
Plan: `.specs/features/transactions/plan.md`

61 checks in 8 slices · 4 one-way doors · 0 open, of which 0 block

Test files, all new, under `modules/ledger/src/transaction/__test__/`: `transaction.dto.test.ts` (unit, pure schemas), `transaction.schedule.test.ts` (unit, pure schedule), `transaction.service.test.ts` (unit, in-memory repository mock in `mocks/`), `transaction.repository.test.ts` (integration, real in-memory SQLite with the committed migrations), `transaction.router.test.ts` (integration, router mounted on Express and called over HTTP); and `apps/api/test/transactions.component.test.ts` (component, whole app with real category and account services). Every test title starts with its check id. The scenarios in `acceptance-tests.md` are the source of the examples; they are not run as a suite.

## Checks

### S1 - Record a transaction

**C1** - POST `/transactions` with a valid body returns `201` with `id` (UUID), `userId`, `date`, `description`, `categoryId`, `accountId`, `type`, `amount`, `recurrence: null`, `instalment: null`, `createdAt`, `updatedAt` (ISO 8601 UTC); amounts come back canonical: `"1000.00"` → `"1000"`, `"229.00"` → `"229"`, `"0.5"` → `"0.5"`, `"20"` → `"20"` (AC S1.1)
Proof: run unit | ✓ C1 POST /transactions returns 201 with the transaction fields and a canonical amount

**C2** - A new transaction is a forecast whatever its date: created on `2026-01-05`, listing `2026-01` shows `status: "forecast"` (AC S1.2)
Proof: run unit | ✓ C2 a new transaction is a forecast even with a past date

**C3** - `type` accepts only `"receipt"` and `"debit"`: `"Debit"`, `"expense"` and an absent type are rejected and nothing is saved (AC S1.3)
Proof: run unit | ✓ C3 type rule accepts receipt and debit only
Proof: run unit | ✓ C3 POST with a bad type returns 400 and saves nothing

**C4** - The amount rule accepts a string holding a positive decimal with at most 12 integer digits and at most 4 decimals: `"0"`, `"-5"`, `"1,5"`, `"abc"`, the number `229`, `"12.12345"` and `"1234567890123"` are rejected; `"12.1234"` and `"123456789012"` are accepted; the same rule makes PATCH and settlement return `400` and change nothing (AC S1.4)
Proof: run unit | ✓ C4 amount rule accepts positive decimals within the bounds only
Proof: run unit | ✓ C4 PATCH and settlement reject an invalid amount with 400 and change nothing
Proof: run unit | ✓ C4 POST with a bad amount returns 400 and saves nothing

**C5** - A description is trimmed and must hold 1 to 100 characters: `""`, `"   "` and 101 characters are rejected; 100 accepted; `"  Gym  "` saves as `"Gym"` (AC S1.5)
Proof: run unit | ✓ C5 description is trimmed and limited to 1 to 100 characters
Proof: run unit | ✓ C5 POST and PATCH with a bad description return 400 and save nothing

**C6** - `date` must be a real calendar date written `YYYY-MM-DD`: `"2026-02-30"`, `"2026-1-5"`, `"05/11/2026"` are rejected; `"2028-02-29"` is accepted (AC S1.6)
Proof: run unit | ✓ C6 date rule accepts real YYYY-MM-DD dates only
Proof: run unit | ✓ C6 POST with a bad date returns 400 and saves nothing

**C7** - `categoryId` and `accountId` are required on create and must be the caller's own existing category and account: a missing id, an unknown id and another user's id each return `400` naming the field and save nothing; `categoryId: null` on PATCH returns `400` (AC S1.7)
Proof: run unit | ✓ C7 category and account must exist and belong to the caller
Proof: run unit | ✓ C7 POST and PATCH answer 400 naming the field for a bad reference

**C8** - A body with both `recurrence` and `instalment`, or a `recurrence` outside `daily`, `weekly`, `monthly`, `annually`, is rejected (AC S1.8)
Proof: run unit | ✓ C8 recurrence and instalment are exclusive and recurrence is one of four values

**C9** - A body carrying `id`, `userId`, `createdAt`, `status` or an unknown field has those fields ignored: the saved transaction has a generated id, the caller's `userId` and a fresh `createdAt` (AC S1.9)
Proof: run unit | ✓ C9 fields outside the contract are ignored

### S2 - See any month

**C10** - GET `/transactions?month=2026-11` lists every occurrence dated `2026-11-01` to `2026-11-30` and none dated `2026-10-31` or `2026-12-01` (AC S2.1)
Proof: run unit | ✓ C10 a month lists its first to last day and nothing outside

**C11** - A month with no occurrences returns `200` with `{ "occurrences": [] }` (AC S2.2)
Proof: run unit | ✓ C11 an empty month returns an empty list
Proof: run unit | ✓ C11 GET of an empty month returns 200 with an occurrences envelope

**C12** - A forecast whose date has passed is listed with settled entries in the same month, none hidden (AC S2.3)
Proof: run unit | ✓ C12 past forecasts are listed together with settled entries

**C13** - Occurrences are ordered by date, then description ignoring case, then `transactionId`: `11-05 Gym`, `11-05 condo`, `11-02 Zed` → `Zed`, `condo`, `Gym` (AC S2.4)
Proof: run unit | ✓ C13 month occurrences are ordered by date then description ignoring case
Proof: run unit | ✓ C13 equal date and description are ordered by transaction id

**C14** - `month` must be `YYYY-MM` with a month `01` to `12`: absent, `"2026-13"`, `"2026-1"`, `"2026-11-05"` return `400` (AC S2.5)
Proof: run unit | ✓ C14 month rule accepts YYYY-MM only
Proof: run unit | ✓ C14 GET with a bad month returns 400

**C15** - Each occurrence carries `transactionId`, `date`, `description`, `categoryId`, `accountId`, `type`, `amount`, `recurrence`, `instalment`, `status`, with the values in force on that date (AC S2.6)
Proof: run unit | ✓ C15 an occurrence carries all fields with the values in force on its date

### S3 - Schedules

**C16** - A one-off has exactly one occurrence, on its date (AC S3.1)
Proof: run unit | ✓ C16 a one-off has a single occurrence on its date

**C17** - Daily from `2026-11-29`: `2026-10` none, `2026-11` → `29`, `30`, `2026-12` → 31 days (AC S3.2)
Proof: run unit | ✓ C17 daily occurrences start on the start date and never end

**C18** - Weekly from `2026-11-05`: `2026-11` → `05`, `12`, `19`, `26`; `2026-12` → `03`, `10`, `17`, `24`, `31`; `2026-10-29` none (AC S3.3)
Proof: run unit | ✓ C18 weekly occurrences fall every seven days

**C19** - Monthly from `2026-11-05`: `2026-10` none, `2026-11` → `05`, `2027-06` → `05` (AC S3.4)
Proof: run unit | ✓ C19 monthly occurrences fall on the start day with no end

**C20** - A monthly start on the 31st falls on the last day of shorter months and returns to the 31st: start `2026-01-31` → `01-31`, `02-28`, `03-31`, `04-30`; start `2028-01-31` → `2028-02-29` (AC S3.5)
Proof: run unit | ✓ C20 monthly occurrences clamp to the last day and return to the start day

**C21** - Annual: start `2026-11-05` → `2027-11-05`; start `2024-02-29` → `2025-02-28`, `2026-02-28`, `2028-02-29` (AC S3.6)
Proof: run unit | ✓ C21 annual occurrences fall once a year and clamp 29 February

**C22** - Instalment `{ 97, 504 }` from `2026-11-15`: `2026-11` → 97, `2026-12` → 98, `2060-10` → 504, `2060-11` none, `2026-10` none; each carries `recurrence: null` and `instalment: { number, total }` (AC S3.7)
Proof: run unit | ✓ C22 an instalment part way through numbers its occurrences and stops at the total
Proof: run unit | ✓ C22 instalment occurrences carry recurrence null and the POST response carries the plan

**C23** - Instalment `{ 1, 10 }` from `2026-11-15`: number 10 on `2027-08-15`, `2027-09` none (AC S3.8)
Proof: run unit | ✓ C23 an instalment from number 1 ends at the total

**C24** - The instalment rule rejects `{ 0, 10 }`, `{ 11, 10 }`, `{ 1, 1000 }`, `{ 1.5, 10 }` and accepts `{ 1, 999 }` (AC S3.9)
Proof: run unit | ✓ C24 instalment rule accepts whole numbers with number within total and total up to 999

**C25** - Occurrences of one transaction listed in different months carry the same `transactionId` (AC S3.10)
Proof: run unit | ✓ C25 occurrences in different months share the transaction id

### S4 - Settle and undo

**C26** - PUT `.../settlement` with `{}` on a forecast occurrence returns `200` with `status: "settled"` and the same amount, and later listings show it settled (AC S4.1)
Proof: run unit | ✓ C26 settling a forecast occurrence marks it settled and keeps its amount
Proof: run unit | ✓ C26 PUT settlement returns 200 with the settled occurrence

**C27** - PUT with `amount: "22"` on `2026-12-05` of a monthly `"20"` → Nov `20` forecast, Dec `22` settled, Jan `20` forecast (AC S4.2)
Proof: run unit | ✓ C27 a real paid amount applies to that occurrence only

**C28** - PUT on an already settled occurrence returns `409` and changes nothing (AC S4.3)
Proof: run unit | ✓ C28 settling twice returns 409 and changes nothing
Proof: run unit | ✓ C28 settling twice returns 409 over HTTP and changes nothing

**C29** - DELETE `.../settlement` on a settled occurrence returns `200` with `status: "forecast"` and the schedule's values, dropping the real amount; on a forecast it returns `409` (AC S4.4)
Proof: run unit | ✓ C29 undoing a settlement restores the forecast and a forecast cannot be undone
Proof: run unit | ✓ C29 undo returns 200 with the forecast and undoing a forecast returns 409 over HTTP

**C30** - No occurrence is settled unless requested, whatever its age: an instalment dated `2026-01-15` and a one-off from last year both list as `forecast` (AC S4.5)
Proof: run unit | ✓ C30 nothing is settled automatically

**C31** - Settlement, edit and delete return `404` for a date that is not an occurrence: monthly on the 5th with `2026-11-06`, a date before the start, an instalment date after its last number, and `"not-a-date"` (AC S4.6)
Proof: run unit | ✓ C31 a date that is not an occurrence returns 404 for settle edit and delete

### S5 - Edit

**C32** - PATCH of a forecast occurrence applies to it and every later forecast occurrence, never an earlier one: condo `"20"` from `2026-11-05`, PATCH `2026-12-05` with `"25"` → Nov `20`, Dec `25`, Jan `25` (AC S5.1)
Proof: run unit | ✓ C32 a forecast edit applies from that occurrence onward

**C33** - A later occurrence already settled is not changed by an edit: Jan settled at `20`, PATCH Dec to `"25"` → Jan stays `20` settled, Feb `25` (AC S5.2)
Proof: run unit | ✓ C33 an edit does not change later settled occurrences

**C34** - PATCH of a settled occurrence changes only that occurrence (AC S5.3)
Proof: run unit | ✓ C34 editing a settled occurrence changes only it

**C35** - An edit from an earlier date replaces a later edit: PATCH Jan `"30"`, then Dec `"25"` → Jan forecast is `25`, with every field of the edited occurrence applied (AC S5.4)
Proof: run unit | ✓ C35 an earlier edit replaces a later planned edit

**C36** - Editing the first occurrence changes the whole series from its start (AC S5.5)
Proof: run unit | ✓ C36 editing the first occurrence changes the whole series

**C37** - PATCH of a one-off forecast changes the entry (AC S5.6)
Proof: run unit | ✓ C37 editing a one-off changes the entry

**C38** - A PATCH body with none of `description`, `categoryId`, `accountId`, `amount`, `type` returns `400` and changes nothing; `date`, `recurrence`, `instalment` in the body are ignored (AC S5.7)
Proof: run unit | ✓ C38 an empty edit returns 400 and schedule fields are ignored

**C39** - After an edit, instalment occurrences keep their numbers from the original start: `{ 97, 504 }` from `2026-11-15`, PATCH `2026-12-15`, `2027-01` still shows 99 (AC S5.8)
Proof: run unit | ✓ C39 an edit keeps instalment numbering

### S6 - Stop and delete

**C40** - DELETE of an occurrence returns `204`, removes it and every later one, and leaves every earlier one as it was: monthly from `2026-11-05`, Nov settled, DELETE `2027-01-05` → Nov (settled) and Dec stay, Jan on gone (AC S6.1)
Proof: run unit | ✓ C40 stopping removes the occurrence and all later ones and keeps earlier ones
Proof: run unit | ✓ C40 DELETE returns 204 and the stopped dates leave the real listing

**C41** - DELETE on the first occurrence, or on a one-off, removes the whole transaction (AC S6.2)
Proof: run unit | ✓ C41 stopping from the first occurrence removes the transaction

**C42** - After a stop, a request for a removed occurrence returns `404` and the listing no longer shows it (AC S6.3)
Proof: run unit | ✓ C42 a removed occurrence is gone
Proof: run unit | ✓ C42 a stopped date returns 404 over HTTP

**C43** - Deleting an instalment from an occurrence follows the same rules: `{ 17, 48 }` from `2026-11-15`, stop `2027-03-15` → `2027-02` shows 20 of 48, `2027-03` none (AC S6.4)
Proof: run unit | ✓ C43 stopping an instalment removes it from the chosen occurrence

**C44** - DELETE of an occurrence in the past succeeds (AC S6.5)
Proof: run unit | ✓ C44 a past occurrence can be deleted

### S7 - Deleted category or account

**C45** - Deleting a category used by transactions succeeds as the Category rules say; every occurrence of those transactions, forecast and settled, stays listed with `categoryId: null` and nothing else changed (AC S7.1)
Proof: run unit | ✓ C45 deleting a used category keeps the transactions with a null category

**C46** - Deleting an account used by transactions leaves every occurrence listed with `accountId: null` and nothing else changed (AC S7.2)
Proof: run unit | ✓ C46 deleting a used account keeps the transactions with a null account

**C47** - Only the occurrences that used the deleted category show `null`; others keep theirs (AC S7.3)
Proof: run unit | ✓ C47 only occurrences that used the deleted category lose it

**C48** - PATCH with only a `description` on an occurrence whose category is `null` returns `200` and keeps `categoryId: null` (AC S7.4)
Proof: run unit | ✓ C48 editing a description keeps a null category

### S8 - Ownership and authentication

**C49** - Every `/transactions` route (POST, GET, PATCH, DELETE occurrence, PUT and DELETE settlement) returns `401` with no `X-User-Id` header and with a blank one (AC S8.1)
Proof: run unit | ✓ C49 every route returns 401 without a user id

**C50** - PATCH, DELETE and both settlement routes return `404` (not `403`) for an id that does not exist and for another user's transaction, and change nothing (AC S8.2)
Proof: run unit | ✓ C50 another user's or unknown transaction returns 404 and changes nothing

**C51** - With two users each owning transactions, GET lists only the caller's (AC S8.3)
Proof: run unit | ✓ C51 the month lists only the caller transactions
Proof: run unit | ✓ C51 two users with data each list only their own over real SQL

### Doors

**C52** - The committed migrations create `transaction`, `transaction_revision` and `transaction_settlement` with the keys of door 1; a second settlement for the same `(transactionId, occurrenceDate)` is rejected by the database; deleting a transaction row removes its revisions and settlements (door 1)
Proof: run unit | ✓ C52 the migrations create the three tables with their keys and cascade

**C53** - Dates are stored as `YYYY-MM-DD` text: the raw `startDate`, `effectiveFrom`, `occurrenceDate` and `stopDate` columns hold `2026-11-05`, not a number (door 2, AD-001)
Proof: run unit | ✓ C53 calendar dates are stored as YYYY-MM-DD text

**C54** - With foreign keys on, deleting a category or account row sets the referencing `categoryId` / `accountId` on revisions and settlements to `NULL` and removes no row (door 3)
Proof: run unit | ✓ C54 deleting a category or account nulls the references in the database

**C55** - The whole app serves the contract of door 4: routes mounted under `/transactions`, `type` and `recurrence` as lowercase strings, `amount` as a string, occurrences addressed by `/:id/occurrences/:date` (door 4)
Proof: run unit | ✓ C55 the app serves the transaction contract under /transactions

**C56** - A write that spans several rows (create, edit, stop) is atomic: when its second statement fails the first is rolled back and the data is unchanged (database.md, Transaction Atomicity)
Proof: run unit | ✓ C56 a multi-row write rolls back as a whole

### Added after verification

**C57** - Undoing a settlement drops the edits made on the settled occurrence: settle `2026-12-05`, edit it to `"99"` and a new description, undo → forecast with `"20"` and the original description (plan Assumptions)
Proof: run unit | ✓ C57 undoing a settlement drops the edits made on the settled occurrence

**C58** - Weekly series cross month boundaries (start `2026-01-29` → `2026-02` has `05`, `12`, `19`, `26`), an instalment starting on the 30th clamps (`{1,6}` from `2026-11-30` → `2027-02-28` is number 4, `2027-05` none), and edit and settle work on a clamped date (monthly from `2026-01-31`: settle `2026-02-28`, edit `2026-04-30`, `2026-02-27` is `404`) (AC S3.3, S3.5, S3.7, S4.1, S5.1)
Proof: run unit | ✓ C58 weekly series cross month boundaries and instalments clamp from a late start day
Proof: run unit | ✓ C58 edit and settle work on a date the schedule clamped

**C59** - Stopping at the first of a month removes that month and a settlement dated after the stop: daily from `2026-11-01`, settled `2026-12-10`, stop `2026-12-01` → Nov has 30 occurrences, Dec none, settle and undo on `2026-12-10` return `404` (AC S6.1)
Proof: run unit | ✓ C59 stopping at the first of a month removes the month and a later settlement

**C60** - Dates in the years 0000 to 0099 follow the same calendar rules: `0000-02-29` is real, `0001-02-29` and `0100-02-29` are not, a weekly series from `0099-12-25` lists `0100-01-01` to `0100-01-29`, monthly from `0000-01-31` falls on `0000-02-29` (AC S1.6, S3.3, S3.5)
Proof: run unit | ✓ C60 dates in the years 0000 to 0099 follow the same calendar rules

**C61** - The amount's 12-digit limit counts the integer part without leading zeros: `"000000000005"` and `"0000000000005"` save as `"5"`, `"1234567890123"` is rejected, an all-zero value is rejected (AC S1.4)
Proof: run unit | ✓ C61 amount digit limit counts the integer part without leading zeros

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /transactions` statuses (3) | 201 C1 · 400 C3, C4, C5, C6, C7, C8 · 401 C49 | - |
| `GET /transactions` statuses (3) | 200 C10, C11 · 400 C14 · 401 C49 | - |
| `PATCH /transactions/:id/occurrences/:date` statuses (4) | 200 C32 · 400 C4, C7, C38 · 404 C31, C50 · 401 C49 | - |
| `DELETE /transactions/:id/occurrences/:date` statuses (3) | 204 C40 · 404 C31, C50 · 401 C49 | - |
| `PUT /transactions/:id/occurrences/:date/settlement` statuses (5) | 200 C26 · 400 C4 · 404 C31, C50 · 409 C28 · 401 C49 | - |
| `DELETE /transactions/:id/occurrences/:date/settlement` statuses (4) | 200 C29 · 404 C31, C50 · 409 C29 · 401 C49 | - |
| `Transaction` response fields (12) | `id` C1 · `userId` C1 · `date` C1 · `description` C1 · `categoryId` C1 · `accountId` C1 · `type` C1 · `amount` C1 · `recurrence` C1 · `instalment` C1 · `createdAt` C1 · `updatedAt` C1 | - |
| `Occurrence` fields (10) | `transactionId` C15 · `date` C15 · `description` C15 · `categoryId` C15 · `accountId` C15 · `type` C15 · `amount` C15 · `recurrence` C15 · `instalment` C15 · `status` C15 | - |
| `type` values (2) | `receipt` C3, C55 · `debit` C3, C55 | - |
| `recurrence` values (5) | `daily` C17 · `weekly` C18 · `monthly` C19 · `annually` C21 · none C16 | - |
| `status` values (2) | `forecast` C2, C30 · `settled` C26 | - |
| amount examples, AC S1.4 (9) | `"0"` C4 · `"-5"` C4 · `"1,5"` C4 · `"abc"` C4 · number `229` C4 · `"12.12345"` C4 · `"12.1234"` C4 · 13 digits C4 · 12 digits C4 | - |
| description examples, AC S1.5 (5) | `""` C5 · `"   "` C5 · 100 chars C5 · 101 chars C5 · `"  Gym  "` C5 | - |
| date examples, AC S1.6 (4) | `2026-02-30` C6 · `2026-1-5` C6 · `05/11/2026` C6 · `2028-02-29` C6 | - |
| reference examples, AC S1.7 (4) | missing id C7 · unknown id C7 · another user's id C7 · `categoryId: null` on PATCH C7 | - |
| month examples, AC S2.5 (4) | absent C14 · `2026-13` C14 · `2026-1` C14 · `2026-11-05` C14 | - |
| month-end examples, AC S3.5 (5) | `01-31` C20 · `02-28` C20 · `03-31` C20 · `04-30` C20 · `2028-02-29` C20 | - |
| annual examples, AC S3.6 (4) | `2027-11-05` C21 · `2025-02-28` C21 · `2026-02-28` C21 · `2028-02-29` C21 | - |
| instalment examples, AC S3.7-S3.9 (9) | 97 C22 · 98 C22 · 504 C22 · after 504 C22 · before start C22 · `{1,10}` end C23 · `{0,10}` C24 · `{11,10}` C24 · `{1,1000}` C24 | - |
| non-occurrence dates, AC S4.6 (4) | `2026-11-06` C31 · before start C31 · after last instalment C31 · `not-a-date` C31 | - |
| edit examples, AC S5.1-S5.4 (4) | forward only C32 · settled kept C33 · earlier edit wins C35 · first occurrence C36 | - |
| stop examples, AC S6.1-S6.4 (4) | later removed C40 · first occurrence C41 · one-off C41 · instalment C43 | - |
| routes needing a user id (6) | POST C49 · GET C49 · PATCH C49 · DELETE occurrence C49 · PUT settlement C49 · DELETE settlement C49 | - |
| added-after-verification examples (5) | undo drops edits C57 · clamped weekly and instalment C58 · stop at the 1st C59 · years 0000-0099 C60 · leading zeros C61 | - |
| one-way doors (4) | stored shape C52, C56 · calendar dates C53 · references nulled C45, C46, C54 · contract C55 | - |
| startup config: router mounting (2 assemblies) | `createLedgerRouters` in the ledger module C55 · `createApp` in apps/api C55 | - |

## Swept

- validation: C3, C4, C5, C6, C7, C8, C14, C24, C38
- failure modes: C56
- idempotency: C28, C29 - a repeated settle or undo is refused with `409` and changes nothing
- authorization: C49, C50, C51
- concurrency: existing - the repository driver is synchronous and a service call has no `await` between its read and its write, so two requests cannot interleave in the single API process; the settlement primary key (C52) rejects a duplicate that slipped past
- data lifecycle: C34, C40, C41, C45, C46, C47
- dependency failure: n/a - no external call in this feature
- state transitions: C26, C27, C28, C29, C30
- observability: n/a - no logging requirement in this feature

## Handoff

- **Settled mid-build:** none
- **Dispatched:** Verifier, sent at code HEAD `c5c43cd` (proofs.md at `d30f761`, 62 pass)
- **Boundary:** C1-C56 built, tests green at `c5c43cd` (63 transaction tests; 114 in the whole suite)
- **Abandoned:** none
- **Notes:** the amount rule needed `abort: true` on its pattern check, found by C4: without it, Zod ran the numeric check on `"1,5"` and threw. CI runs only `modules/ledger` tests, so the whole-app checks (C45-C48, C55) run locally here but not in that CI job. The plan was approved 2026-11-12 ("Ok Agree"); AD-001 is in `.specs/STATE.md`.
