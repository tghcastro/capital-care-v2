# Child Categories

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by tghcastro, 2026-11-25

## Situation

- Effort: in active construction - flat categories (create, rename, delete, list) are built and in use by transactions; the tiers, the name rules and the tree in the web site are not.
- Decision: committed by tghcastro, 2026-11-25, as a split of the 2026-11-06 Category Management PRD (`.prd/category-management.md`): the flat base is treated as finished, and this PRD carries what that PRD promised and the first version did not deliver.
- In flight: where this PRD and the Category Management PRD disagree, this one wins for tiers, name rules, deletion and listing; transactions, accounts and monthly balance are specified in their own PRDs and stay out.
- At stake: cheap to undo - the only existing categories are test data the owner is willing to lose; the one-way part is a cascading delete, which uncategorizes transactions.

## Problem

Construction. Category Management promised a tree of up to 3 tiers and the first version shipped a flat list, so categories cannot be organised and the owner cannot rebuild their full category tree in Capital Care. Today the list is a stand-in in the web site, and the owner keeps their tree in the other finance app. Name rules promised in the first PRD (short names, plain characters, no duplicates in any letter case) are also missing, so the same category can exist twice with different capitalisation. Nothing stalls technically, but the owner cannot stop using the other app for categories until this ships, which is the goal Category Management was started for.

Unmeasured: there is no count of the owner's categories in the other app, and nobody tracks category usage; the owner says they have only test data in Capital Care today.

## Success

- Worked if: the owner's full category tree is set up in Capital Care and they no longer maintain categories in the other app, within about a month of release.
- Going wrong: they keep editing categories in the other app, or the 3-tier limit or the name rules block categories they want.
- Review: one month after release - tghcastro.

## Boundary

In: categories with up to 3 tiers (root, child, grandchild); creating under a parent; renaming; moving a category, with everything under it, to another parent or to the top level; deleting a category together with everything under it; name rules; listing as a tree; showing and managing the tree in the web site (category list, category picker, create, move, delete with a confirmation); a log record of every category change.

Out: importing the tree from the other app - not requested.
Out: archiving or soft delete - delete is permanent by decision.
Out: sharing categories between users - each user keeps only their own categories.
Out: moving or merging the transactions of a deleted category into another category - they become uncategorized and the existing uncategorized filter finds them.
Out: more than 3 tiers - fixed by decision.

Unchanged: each user sees only their own categories; transactions keep their category until it is deleted; the existing uncategorized filter; the existing data, which is test data and may be deleted.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Create a root category | Saved with a valid, unique name | The new category in the list |
| Create a child or a grandchild | Saved under the chosen parent | It nested under its parent |
| Create under a grandchild (would be a 4th tier) | Rejected, nothing saved | A message that the maximum depth is 3 tiers |
| Name empty, missing, over 30 characters, or with anything other than letters, digits and spaces | Rejected, nothing saved | A clear message naming the rule broken |
| Name already used, in any letter case, anywhere in the user's tree | Rejected, nothing saved | A message that the name is taken |
| Rename to a name that passes every name rule | Saved; renaming to its own name is accepted | The updated name |
| Move a category to any valid parent, or to the top level | Saved; everything under it moves along | The category, with its children, in its new place |
| Move that would exceed 3 tiers, or into itself or one of its own descendants | Rejected, nothing moved | A message explaining why |
| Update, move or delete a category that does not exist, or belongs to another user | Nothing changes | A not-found message |
| Delete a category with no children | Removed permanently | It is gone from the list |
| Delete a category with children, in the API | It and all descendants removed permanently, with no extra confirmation | None of them in the list |
| Delete a category with children, in the web site | The person is told how many categories will be removed and that it is permanent, and must confirm | A confirmation, then the list without them |
| Delete a category (or branch) that has transactions | Deleted anyway; those transactions stay and become uncategorized | The transactions under the uncategorized filter |
| List with no categories yet | Empty result, not an error | An empty list |
| List with categories | All categories as top-level ones with children nested, in alphabetical order at each level | The full tree, first level of children expanded by default in the web site |
| Pick a category when adding or editing a transaction | Categories are chosen from the tree, any tier | The tree in the picker |
| Create, rename or update, move, or delete a category | A log record is kept with the user id, the category name and the category id | Owner, in the logs |

## Open questions

1. Log records when a delete removes a branch - default taken: one record per category removed, each with its own name and id, so the log shows exactly what was lost.
2. Whether a category's name in the log after a rename or a move is the old name, the new one, or both - default taken: the name after the change, with the old name as well for a rename.
3. Cascading delete in the API itself has no confirmation, as in the original PRD; the web site asks first - default taken: keep it that way; revisit if a delete by mistake ever happens.
