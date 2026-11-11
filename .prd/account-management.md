# Account Management

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by Thiago de Castro, 2026-11-11

## Situation

- Effort: not shipped yet
- Decision: committed by Thiago de Castro, 2026-11-11, in the planning of the Accounts phase (previously only an idea; named as a later phase in the Category Management PRD)
- In flight: copies Category Management as precedent (name rules, uniqueness, hard delete, alphabetical list), without child accounts; Transactions and the web site are specified later and stay out
- At stake: cheap to undo - single-user personal project, no shared data

## Problem

Construction. An Account is one of the ways Thiago pays for a Transaction (for example "Money", "Bank A account", "Credit Card from institution C"). Every Transaction must be linked to exactly one Account, so Transactions cannot be specified or built until Accounts exist. Building Transactions first would mean using a stand-in for the account and doing that work twice, which is why Accounts come before Transactions. Unmeasured: no current count of accounts or usage; nobody tracks it, and it does not exist yet to measure.

## Success

- Worked if: Thiago's real accounts (money, bank accounts, credit cards) are all set up in Capital Care and he no longer maintains them in the other finance app, within about a month of release.
- Going wrong: he cannot express an account he actually pays with (for example because of the name rules), or he finds himself wanting account attributes such as type or balance.
- Review: one month after release - Thiago.

## Boundary

In: create, rename, delete, and list accounts, as a flat list with no child accounts. Names follow the same rules as Category names. The maximum number of accounts is a system-level limit, not something the user sets: 5 in development (to make the limit easy to test) and 99 in production. How the system receives that value is decided later, in design.

Out: Transactions - separate phase. Child accounts - accounts are a flat list by decision. Account types or attributes such as balance or currency - not needed for this bet. Archiving or soft delete - delete is hard by decision. Web site - follows once the API exists. Multiple users and sharing - personal single-user use. User-facing control of the limit - it belongs to the system, not the user.

Unchanged: Categories. This feature does not alter them.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Create an account with a valid, unique name | Saved | The new account in the list |
| Name empty, missing, over 30 chars, or with characters other than letters, digits, spaces | Rejected, nothing saved | A clear message naming the rule broken |
| Name already used (any case) | Rejected, nothing saved | A message that the name is taken |
| Create when the number of accounts already equals the system limit (5 in development, 99 in production) | Rejected, nothing saved (hard stop) | A message that the maximum number of accounts is reached, stating the limit |
| Rename | Saved if the new name passes all name rules; renaming to its own name is accepted | The updated name |
| Update or delete an account that does not exist | Nothing changes | A not-found message |
| Delete an account | Removed permanently | It is gone from the list |
| List with no accounts yet | Empty result, not an error | An empty list |
| List with accounts | All accounts returned, alphabetical by name | The full list |

## Open questions

1. If the system limit is later lowered below the number of accounts that already exist - default taken: existing accounts are kept, and creating new ones is rejected until the count falls under the limit.
2. Whether the web site should confirm before deleting an account - not decided here; the API deletes immediately, and this is discussed when the web interface phase starts.
