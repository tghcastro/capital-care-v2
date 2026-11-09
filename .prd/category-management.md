# Category Management

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by Thiago de Castro, 2026-11-06

## Situation

- Effort: not shipped yet
- Decision: committed by Thiago de Castro, 2026-11-06, in the project kickoff for Capital Care
- In flight: copies nothing as precedent; Transactions (Date, Description, Amount, Category, Account), Accounts, and the web site are specified later and stay out
- At stake: cheap to undo - single-user personal project, no shared data

## Problem

Absence. Thiago cannot yet organise his personal expenses in a tool he owns and shapes; today he uses another finance app. Categories are the first attribute every later Transaction needs, so nothing else in the tracker can start without them. If this is never built, the tracker has no way to classify spending. Unmeasured: no current count of categories or usage; nobody tracks it, and it does not exist yet to measure.

## Success

- Worked if: Thiago's full category tree is set up in Capital Care and he no longer maintains categories in the other app, within about a month of release.
- Going wrong: he keeps editing categories in the other app, or finds the 3-tier limit or name rules blocking the categories he wants.
- Review: one month after release - Thiago.

## Boundary

In: create, update, rename, re-parent, delete, and list categories, with up to 3 tiers.

Out: Transactions and Accounts - separate phases. Web site - follows once the API exists. Multiple users, sharing, and archiving or soft delete - personal single-user use, and delete is hard by decision.

Unchanged: nothing existing is altered; this is the first capability.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Create a root category | Saved with a valid, unique name | The new category in the list |
| Create a child or grandchild | Saved under the chosen parent | It nested under its parent |
| Name empty, missing, over 30 chars, or with characters other than letters, digits, spaces | Rejected, nothing saved | A clear message naming the rule broken |
| Name already used (any case, anywhere in the tree) | Rejected, nothing saved | A message that the name is taken |
| Create under a grandchild (would be a 4th tier) | Rejected | A message that the maximum depth is 3 tiers |
| Rename | Saved if the new name passes all name rules; renaming to its own name is accepted | The updated name |
| Re-parent | Allowed to any valid parent, with its descendants moving along | The category in its new place |
| Re-parent that exceeds 3 tiers, or into itself or its own descendant | Rejected, nothing moved | A message explaining why |
| Update or delete a category that does not exist | Nothing changes | A not-found message |
| Delete a category without children | Removed permanently | It is gone from the list |
| Delete a category with children | It and all descendants removed permanently, no extra confirmation | None of them in the list |
| List with no categories yet | Empty result, not an error | An empty list |
| List with categories | All categories returned as roots with children nested | The full tree |

## Open questions

1. Display order of categories in the list - default taken: alphabetical by name at each level.
2. Whether the web site should confirm before a cascading delete - default taken: not decided here; the API deletes immediately, and the web phase may add a confirmation.
