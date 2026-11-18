# Monthly Balance verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 6ff326d
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `monthly-balance.component.test.ts` `MB1 October 2026 ...` to `MB1 April 2027 ...` (7 tests) | yes |
| C2 | `transaction.balance.test.ts` `MB2 settled and forecast occurrences both count`, `MB2 a monthly receipt of 100.00 from 2026-01-15 opens April 2026 at 300.00`, `MB2 the same receipt stopped from 2026-03-15 opens April 2026 at 200.00`, `MB2 another user's transactions never count` | yes |
| C3 | `monthly-balance.component.test.ts` `MB3 November 2026 ...`, `MB3 December 2026 ...`, `MB3 January 2027 ...`, `MB3 March 2027 ...` | yes |
| C4 | `monthlyBalance.test.tsx` `MB4 shows the day balances and the summary the balance route returns` | yes |
| C5 | `monthly-balance.component.test.ts` `MB5 February 2027 lists nothing and carries 7,531.00 forward to March`; `monthlyBalance.test.tsx` `MB5 an empty month shows No transactions this month ...` | yes |
| C6 | `monthly-balance.component.test.ts` `MB6 November 2026 ...` to `MB6 February 2027 ...` (4 tests) | yes |
| C7 | `monthly-balance.component.test.ts` `MB7 January 2027 lists only Checking Account and continues from its closing balance` | yes |
| C8 | `monthly-balance.component.test.ts` `MB8 both accounts together in January 2027 have final 7,531.00`; `transaction.balance.test.ts` `MB8 account none counts only occurrences with no account, opening balance included` | yes |
| C9 | `monthlyBalance.test.tsx` `MB9 sends only the month when no filter is selected`, `MB9 sends one category and account param per selected id and none for the pseudo-entries`, `MB9 lists only the occurrences the API returns for the selected filters` | yes |
| C10 | `monthly-balance.component.test.ts` `MB10 Shopping in January 2027 starts at 0.00 and returns no totals` | yes |
| C11 | `monthly-balance.component.test.ts` `MB11 Groceries and Checking Account in January 2027 follow the category rule` | yes |
| C12 | `monthlyBalance.test.tsx` `MB12 hides the four totals while a category is selected and shows them again after deselecting it` | yes |
| C13 | `transaction.balance.test.ts` `MB13 listMonth matches any selected id within a param and both params together`, `MB13 category none and account none match null references and another user's ids match nothing` | yes |
| C14 | `monthly-balance.component.test.ts` `MB14 editing the amount of Dentist` | yes |
| C15 | `monthly-balance.component.test.ts` `MB15 deleting New office chair` | yes |
| C16 | `monthly-balance.component.test.ts` `MB16 moving Condo fees to the next month`; `transaction.balance.test.ts` `MB16 moving a one-off keeps its id values and settlement` | yes |
| C17 | `monthly-balance.component.test.ts` `MB17 moving Wireless keyboard to Checking Account` | yes |
| C18 | `transaction.balance.test.ts` `MB18 moving a monthly occurrence shifts it and every later one` | yes - but only on an open-ended series; see Findings |
| C19 | `transaction.balance.test.ts` `MB19 moving an instalment keeps the numbering and the total` | yes |
| C20 | `transaction.balance.test.ts` `MB20 moving the first occurrence moves the whole series` | yes - the dates assertion holds it (the `definitions.size > 0` line adds nothing) |
| C21 | `transaction.balance.test.ts` `MB21 moving a settled occurrence of a series is refused ...`, `MB21 moving an occurrence with a later settled one is refused ...`; `transaction.router.test.ts` `MB21 PATCH date on a settled series occurrence answers 409` | yes |
| C22 | `transaction.dto.test.ts` `MB22 the edit date accepts real YYYY-MM-DD dates only`; `transaction.router.test.ts` `MB22 PATCH with an invalid date answers 400 and changes nothing`; `transaction.balance.test.ts` `MB22 a date equal to the current one moves nothing` | yes |
| C23 | `transaction.repository.test.ts` `MB23 a failed series shift leaves the old series unchanged` | yes |
| C24 | `transaction.router.test.ts` `MB24 GET balance answers 400 for a bad month and 401 without a user id`, `MB24 GET transactions with category and account params answers 200 ...`, `C14 GET with a bad month returns 400`, `C49 every route returns 401 without a user id` | yes - the 400/401 cases for `GET /transactions` carry no filter params, but month and user checks run before filters are read |
| C25 | `transaction.router.test.ts` `MB25 PATCH date answers 404 for another user's transaction and 401 without a user id` | yes |
| C26 | `monthlyBalance.test.tsx` `MB26 shows the API detail when the balance request fails and Try again refetches` | yes |
| C27 | `transaction.balance.test.ts` `MB27 moving inside a stopped series keeps the number of occurrences it had left`, `MB27 moving the last occurrence of a stopped series past its old stop keeps it` | appended by the builder to close the finding below; not judged by the Verifier - it fails at 6ff326d (the Verifier's reproduction) and passes at 432de8a |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Moving an occurrence of a stopped series drops the stop, so the new series runs forever and adds occurrences, and balance, to every later month | Throwaway test at 6ff326d: a monthly 100.00 from 2027-01-10 stopped from 2027-06-10, move 2027-03-10 to 2027-03-20, lists 2027-06-20, 2027-07-20 and 2028-01-20 (expected only Mar 20, Apr 20, May 20). `TransactionService.shiftSeries` passes no stop to `repository.shiftSeries`, and `insertTransaction` writes `stopDate: null`. AC 12 replaces "that occurrence and every later one"; the old series had none from 2027-06-10. No check covers a stopped series (C18 to C20 all use open-ended or instalment entries) | carry the old `stopDate`, moved by the same offset or kept as the old stop, onto the new series, and add a check that moving inside a stopped series keeps its end | `432de8a` - C27 |
