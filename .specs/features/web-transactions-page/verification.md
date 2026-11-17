# Web Transactions Page verification

**Verdict**: PASS
**Proofs**: `proofs.md` at 8e5eb71
**Verifier**: independent sub-agent (author != verifier). The sub-agent returned its report in chat and its `verification.md` was not found on disk; the builder transcribed the report below, with `Closed` filled in. The first verdict was FAIL on the findings below; all are closed.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `TransactionsPage.test.tsx` `shows Capital Care and alice and sends X-User-Id alice on every request` | yes |
| C2 | `TransactionsPage.test.tsx` `loads the current month` | yes |
| C3 | `TransactionsPage.test.tsx` `shows a loading state while occurrences load`, `shows the API detail on failure and Try again refetches`, `TransactionsPage details` `shows Something went wrong when a failure carries no detail` | yes (fallback test added in 8e5eb71) |
| C4 | `TransactionsPage.test.tsx` `shows No transactions this month with 0.00 totals` | yes (exact text on all 4 totals after 8e5eb71) |
| C5 | `format.test.ts` `groupTitle`; `ledgerView.test.ts` `orders groups ascending by date` | yes |
| C6 | `TransactionsPage.test.tsx` `renders every row detail`; `TransactionsPage details` `shows the recurring icon for an instalment-only transaction` | yes (instalment case added in 8e5eb71) |
| C7 | `format.test.ts` `formatAmount`; `ledgerView.test.ts` `sums 0.1 and 0.2 exactly` | yes |
| C8 | `TransactionsPage.test.tsx` `loads the month picked in the date filter` | yes |
| C9 | `format.test.ts` `shiftMonth`; `TransactionsPage.test.tsx` `Next month and Previous month buttons change the month` | yes |
| C10 | `ledgerView.test.ts` `running balance is 399.66...`; `TransactionsPage.test.tsx` `shows the running balance after each day group` | yes |
| C11 | `ledgerView.test.ts` `totals are received, debits, net and final balance`; `TransactionsPage.test.tsx` `shows the monthly summary in the footer` | yes (exact text after 8e5eb71) |
| C12 | `ledgerView.test.ts` `filters limit the balance and totals to visible rows`, `a category filter limits the balance and totals to visible rows` | yes (category case added in 8e5eb71) |
| C13 | `TransactionsPage.test.tsx` `Back to top scrolls the window to the top` | yes |
| C14 | `TransactionsPage.test.tsx` `quick-add posts a one-off transaction and lists it` | yes |
| C15 | `TransactionsPage.test.tsx` `More details sends the chosen recurrence`, `More details sends an instalment and hides recurrence` | yes (recurrence cases assert no instalment key after 8e5eb71) |
| C16 | `TransactionsPage.test.tsx` `shows schema messages and posts nothing for amount 0 and a 101 character description` | yes |
| C17 | `TransactionsPage.test.tsx` `shows the API detail and keeps typed values when create fails` | yes |
| C18 | `TransactionsPage.test.tsx` `clears the quick-add form and refetches after create` | yes |
| C19 | `TransactionsPage.test.tsx` `clicking the icon of a forecast occurrence settles it` | yes |
| C20 | `TransactionsPage.test.tsx` `clicking the icon of a settled occurrence unsettles it` | yes |
| C21 | `TransactionsPage.test.tsx` `shows the API detail and keeps the icon when settle fails` | yes |
| C22 | `panels.test.tsx` `categories panel` `lists the pseudo-entry first then names alphabetically` | yes |
| C23 | `ledgerView.test.ts` `category filter matches any selected id and Uncategorized matches null`; `panels.test.tsx` `categories panel` `selecting and deselecting items filters the list` | yes |
| C24 | `panels.test.tsx` `categories panel` `Add posts a new item and lists it` | yes |
| C25 | `panels.test.tsx` `categories panel` `Edit patches the name`, `the pseudo-entry offers no edit or delete` | yes |
| C26 | `panels.test.tsx` `categories panel` `confirmed Delete removes the item`, `Delete answered 409 shows the detail and keeps the item` | yes |
| C27 | `panels.test.tsx` `categories panel` `an empty name shows a message and keeps the dialog open`, `a duplicate name answered 409 shows the detail and keeps the dialog open` | yes |
| C28 | `panels.test.tsx` `accounts panel` `lists the pseudo-entry first then names alphabetically` | yes |
| C29 | `ledgerView.test.ts` `account filter Unassigned matches null accountId`, `an account filter matches any of several selected accounts`; the `accounts panel` tests in `panels.test.tsx` | yes (OR case added in 8e5eb71) |
| C30 | `ledgerView.test.ts` `category and account filters combine with AND` | yes |
| C31 | walk | yes after fix (Inter now bundled via @fontsource-variable/inter; computed style checked in a real browser) |
| C32 | walk | yes (375px: page width equals viewport, panels stacked; checked in a real browser) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Door 1's literal shape not met: client had `settle(id, date)`, plan names `settle(id, date, amount?)` | `packages/shared/src/api-client.ts` `settle:` line | add the optional `amount` argument and send it when given | 8e5eb71 - `settle` takes `amount?`; C19 still proves the default `{}` call |
| C31: Inter was never loaded, so AC 31 was met on paper only | `apps/web/index.html` had no font link; `index.css` only named Inter | bundle Inter | 8e5eb71 - `@fontsource-variable/inter` imported in `index.css`, woff2 files appear in `pnpm build` output; C31 walk |
| C4 and C11 footer assertions loose (substring, 2 of 4 values) | `TransactionsPage.test.tsx` empty-month and monthly-summary tests | exact text on all four values | 8e5eb71 - C4 and C11 tests |
| C15 never asserted that recurrence cases send no `instalment` | `More details sends the chosen recurrence` used `toMatchObject` | assert the key is absent | 8e5eb71 - C15 test |
| C6: instalment-only recurring icon untested | `renders every row detail` only set `recurrence` | add an instalment-only row | 8e5eb71 - `shows the recurring icon for an instalment-only transaction` (C6) |
| C12, C23, C29 prove the rules narrowly (no category-filter totals case; no two-account OR case) | `ledgerView.test.ts` | add both cases | 8e5eb71 - `a category filter limits the balance and totals to visible rows` (C12), `an account filter matches any of several selected accounts` (C29) |
| The 'Something went wrong' fallback of AC 3 had no test | C3 tests always sent a `detail` | add a 500 with no body | 8e5eb71 - `shows Something went wrong when a failure carries no detail` (C3) |
| Editing a category could not clear its description (empty value dropped from the PATCH body) | `FilterPanel.tsx` `submit` | send null on edit when cleared | 8e5eb71 - `categories panel description` `Edit sends null when the description is cleared` (C25) |

Probed with throwaway examples nobody named (all behaved correctly): negative balance across many decimals, a receipts-only month, `formatAmount` on `-1234567.891`, `-0.005`, `-0.001`, Uncategorized plus a real category selected together, month roll from 2026-12 to 2027-01.
