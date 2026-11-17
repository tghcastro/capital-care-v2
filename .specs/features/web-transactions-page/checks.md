# Web Transactions Page checks

Build: `pnpm type-check`; `pnpm lint`; `pnpm build`
Run web: `npx vitest run --project web --reporter=verbose`
Plan: `.specs/features/web-transactions-page/plan.md`

32 checks in 8 slices · 1 one-way door · 0 open

## Checks

### S1 - See a month of transactions grouped by day

**C1** - The page shows "Capital Care" and user `alice`, and every API request carries `X-User-Id: alice` (AC 1, door 1)
Proof: run web | ✓ TransactionsPage > shows Capital Care and alice and sends X-User-Id alice on every request

**C2** - The page loads the current month from `GET /transactions?month=YYYY-MM` (AC 2)
Proof: run web | ✓ TransactionsPage > loads the current month

**C3** - Loading shows a loading state; a failure shows the API detail and "Try again" refetches (AC 3)
Proof: run web | ✓ TransactionsPage > shows a loading state while occurrences load
Proof: run web | ✓ TransactionsPage > shows the API detail on failure and Try again refetches

**C4** - An empty month shows "No transactions this month" and 0.00 footer totals (AC 4)
Proof: run web | ✓ TransactionsPage > shows No transactions this month with 0.00 totals

**C5** - Groups are titled `DD/MM/YYYY - Weekday` and ordered ascending (AC 5)
Proof: run web | ✓ groupTitle > formats 2026-11-16 as 16/11/2026 - Monday
Proof: run web | ✓ ledgerView > orders groups ascending by date

**C6** - A row shows description, account, category, signed amount, recurring and settled icons, with Uncategorized/Unassigned for null ids (AC 6)
Proof: run web | ✓ TransactionsPage > renders every row detail

**C7** - Amounts show grouping and two decimals, summed with decimal.js (AC 7)
Proof: run web | ✓ formatAmount > formats 1399.66 as 1,399.66 and 0.5 as 0.50
Proof: run web | ✓ ledgerView > sums 0.1 and 0.2 exactly

### S2 - Month navigation

**C8** - Picking a month and year loads that month (AC 8)
Proof: run web | ✓ TransactionsPage > loads the month picked in the date filter

**C9** - Previous/Next move one month and roll the year (AC 9)
Proof: run web | ✓ shiftMonth > rolls 2026-12 forward to 2027-01 and 2027-01 back to 2026-12
Proof: run web | ✓ TransactionsPage > Next month and Previous month buttons change the month

### S3 - Running balance and monthly summary

**C10** - The balance after each day starts from 0.00: 399.66 after day one, -0.34 after a later 400.00 debit (AC 10)
Proof: run web | ✓ ledgerView > running balance is 399.66 after day one and -0.34 after a later 400.00 debit
Proof: run web | ✓ TransactionsPage > shows the running balance after each day group

**C11** - The footer shows received, debits, net and final balance (AC 11)
Proof: run web | ✓ ledgerView > totals are received, debits, net and final balance
Proof: run web | ✓ TransactionsPage > shows the monthly summary in the footer

**C12** - Active filters limit the running balance and totals to visible rows (AC 12)
Proof: run web | ✓ ledgerView > filters limit the balance and totals to visible rows

**C13** - "Back to top" scrolls the window to the top (AC 13)
Proof: run web | ✓ TransactionsPage > Back to top scrolls the window to the top

### S4 - Add a transaction

**C14** - Submitting the quick-add form posts the transaction and the new occurrence appears (AC 14)
Proof: run web | ✓ TransactionsPage > quick-add posts a one-off transaction and lists it

**C15** - More details offers each recurrence or an instalment, never both (AC 15)
Proof: run web | ✓ TransactionsPage > More details sends the chosen recurrence
Proof: run web | ✓ TransactionsPage > More details sends an instalment and hides recurrence

**C16** - Invalid input shows the schema message and sends no request (AC 16)
Proof: run web | ✓ TransactionsPage > shows schema messages and posts nothing for amount 0 and a 101 character description

**C17** - A 4xx on submit shows the API detail and keeps the typed values (AC 17)
Proof: run web | ✓ TransactionsPage > shows the API detail and keeps typed values when create fails

**C18** - A successful submit clears the form and refetches the month (AC 18)
Proof: run web | ✓ TransactionsPage > clears the quick-add form and refetches after create

### S5 - Settle and unsettle

**C19** - Clicking the settled icon of a forecast occurrence settles it (AC 19)
Proof: run web | ✓ TransactionsPage > clicking the icon of a forecast occurrence settles it

**C20** - Clicking the settled icon of a settled occurrence unsettles it (AC 20)
Proof: run web | ✓ TransactionsPage > clicking the icon of a settled occurrence unsettles it

**C21** - A failed settle shows the API detail and leaves the icon (AC 21)
Proof: run web | ✓ TransactionsPage > shows the API detail and keeps the icon when settle fails

### S6 - Categories panel

**C22** - Uncategorized first, then categories alphabetically, flat (AC 22)
Proof: run web | ✓ categories panel > lists the pseudo-entry first then names alphabetically

**C23** - Selecting categories filters rows; Uncategorized matches null; deselect and none-selected work (AC 23)
Proof: run web | ✓ ledgerView > category filter matches any selected id and Uncategorized matches null
Proof: run web | ✓ categories panel > selecting and deselecting items filters the list

**C24** - Add category posts and lists it (AC 24)
Proof: run web | ✓ categories panel > Add posts a new item and lists it

**C25** - Edit patches the name; the pseudo-entry offers no edit or delete (AC 25)
Proof: run web | ✓ categories panel > Edit patches the name
Proof: run web | ✓ categories panel > the pseudo-entry offers no edit or delete

**C26** - Confirmed delete removes the item; a 409 shows its detail and keeps it (AC 26)
Proof: run web | ✓ categories panel > confirmed Delete removes the item
Proof: run web | ✓ categories panel > Delete answered 409 shows the detail and keeps the item

**C27** - An empty or duplicate (409) name shows the message and keeps the dialog open (AC 27)
Proof: run web | ✓ categories panel > an empty name shows a message and keeps the dialog open
Proof: run web | ✓ categories panel > a duplicate name answered 409 shows the detail and keeps the dialog open

### S7 - Accounts panel

**C28** - Unassigned first, then accounts alphabetically, flat (AC 28)
Proof: run web | ✓ accounts panel > lists the pseudo-entry first then names alphabetically

**C29** - Accounts filter, add, edit and delete behave like categories; Unassigned matches null (AC 29)
Proof: run web | ✓ ledgerView > account filter Unassigned matches null accountId
Proof: run web | ✓ accounts panel > selecting and deselecting items filters the list
Proof: run web | ✓ accounts panel > Add posts a new item and lists it
Proof: run web | ✓ accounts panel > Edit patches the name
Proof: run web | ✓ accounts panel > the pseudo-entry offers no edit or delete
Proof: run web | ✓ accounts panel > confirmed Delete removes the item
Proof: run web | ✓ accounts panel > Delete answered 409 shows the detail and keeps the item
Proof: run web | ✓ accounts panel > an empty name shows a message and keeps the dialog open
Proof: run web | ✓ accounts panel > a duplicate name answered 409 shows the detail and keeps the dialog open

**C30** - Category and account filters combine with AND (AC 30)
Proof: run web | ✓ ledgerView > category and account filters combine with AND

### S8 - Look and layout

**C31** - Screens follow `docs/tech/definitions/design.md` (AC 31)
Proof: walk - open the page in a browser at 1280px and check lime primary buttons, 24px radius, Inter, sage canvas with white cards

**C32** - Under 768px the panels stack above the list with no horizontal page scroll (AC 32)
Proof: walk - open the page at 375px and check the panels stack and the page does not scroll sideways

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| consumed GET statuses (2) | 200 C2 · 4xx C3 | - |
| mutating calls consumed (9) | POST transactions C14 · PUT settlement C19 · DELETE settlement C20 · POST category C24 · PATCH category C25 · DELETE category C26 · POST account C29 · PATCH account C29 · DELETE account C29 | - |
| recurrence values (4) | daily C15 · weekly C15 · monthly C15 · annually C15 (table-driven, 4 cases) | - |
| pseudo-entries (2) | Uncategorized C23 · Unassigned C29 | - |
| filter combinations (3) | category only C23 · account only C29 · both C30 | - |
| AC 6 examples (4) | receipt 500.01 C6 · debit 100.35 C6 · null category C6 · null account C6 | - |
| AC 10 examples (2) | 399.66 C10 · -0.34 C10 | - |
| AC 9 boundaries (2) | 2026-12 to 2027-01 C9 · 2027-01 to 2026-12 C9 | - |
| door 1: API client sets `X-User-Id` (1 place) | every request carries it C1 | - |
| controls (16) | month picker C8 · Previous month C9 · Next month C9 · Back to top C13 · quick-add submit C14 · More details C15 · Try again C3 · settled icon C19 · category select C23 · category add C24 · category edit C25 · category delete C26 · account select C29 · account add C29 · account edit C29 · account delete C29 | - |

## Swept

- validation: C16, C27
- failure modes: C3, C17, C21, C26
- idempotency: n/a - the page sends one request per gesture; the API owns retries
- authorization: C1 (header); existing - the API rejects a missing header with 401
- concurrency: n/a - no shared client state beyond the query cache, which refetches after each mutation (C18)
- data lifecycle: C18 (form cleared after save), C24-C26 (lists refetch after change)
- dependency failure: C3
- state transitions: C19, C20
- observability: n/a - no logging requirement in this slice

## Handoff

- **Settled mid-build:** user answered four questions during planning (AD-002, AD-003, settle toggle); approved the plan 2026-11-17 "Ok. Approved"
- **Dispatched:** none yet
- **Boundary:** none closed yet
- **Abandoned:** none
- **Walked:** not yet
