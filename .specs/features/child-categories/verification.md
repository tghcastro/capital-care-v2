# Child Categories verification

**Verdict**: PASS
**Proofs**: `proofs.md` at d7be693
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `category.tree.test.ts` `AC1 a category with no parentId, absent or null, is a root`; `categories.component.test.ts` `AC1 AC2 answers 201 with parentId null for a root and the parent id for a child` | yes |
| C2 | `category.tree.test.ts` `AC2 a category created under a root or a child gets that parentId`; `categories.component.test.ts` `AC1 AC2 answers 201 ...` | yes - also covers the "parent at depth 2 -> 201" example of AC 3 |
| C3 | `category.tree.test.ts` `AC3 creating under a grandchild answers maximum depth is 3 tiers and saves nothing`; `categories.component.test.ts` `AC3 AC4 AC10 AC13 answers 400, 404, 409 and 401 with their detail` | yes |
| C4 | `category.tree.test.ts` `AC4 a parentId that does not exist or is another user's answers Parent category not found`; `categories.component.test.ts` `AC3 AC4 AC10 AC13 ...` | yes |
| C5 | `category.tree.test.ts` `AC5 lists only roots, children nested under them and grandchildren under those, with parentId`; `categories.component.test.ts` `AC5 AC6 AC7 answers the nested tree, alphabetical at each level, reversed with sort=-name` | yes |
| C6 | `category.tree.test.ts` `AC6 orders every level alphabetically ignoring case and accents, reversed with -name`; `categories.component.test.ts` `AC5 AC6 AC7 ...` | yes - both plan examples, both directions |
| C7 | `category.tree.test.ts` `AC7 a user with no categories gets an empty list`; `categories.component.test.ts` `AC5 AC6 AC7 ...` | yes |
| C8 | `category.tree.test.ts` `AC8 lists only the acting user's categories`; `category.tree.test.ts` `AC4 a parentId that does not exist or is another user's ...` | yes |
| C9 | `category.names.test.ts` `AC9 stores the name normalised: trimmed, inner spaces collapsed, NFC` | yes - the second input is really decomposed (`u` + U+0301); see finding 1 for what trim also removes |
| C10 | `category.names.test.ts` `AC10 a missing, non-string or blank name on create answers name is required`; `AC10 on update an absent name keeps it and an empty one answers name is required`; `categories.component.test.ts` `AC3 AC4 AC10 AC13 ...` | yes |
| C11 | `category.names.test.ts` `AC11 accepts 30 characters and refuses 31, counting characters not bytes`; `AC11 the length rule applies to a rename`; `categories.component.test.ts` `AC18 AC19 AC20 AC25 AC13 ...` | yes |
| C12 | `category.names.test.ts` `AC12 accepts letters with accents, digits and spaces and refuses anything else`; `AC12 the character rule applies to a rename`; `categories.component.test.ts` `AC3 AC4 AC10 AC13 ...` | yes for inner characters; a leading or trailing tab or newline is not tested and is accepted (finding 1) |
| C13 | `category.names.test.ts` `AC13 a name taken in any letter case anywhere in the tree answers name is taken`; `AC13 renaming to a name another category holds answers name is taken`; `category.migration.test.ts` `AC13 the unique key refuses a second row with the same name key and answers name is taken`; `categories.component.test.ts` `AC3 AC4 AC10 AC13 ...` | yes |
| C14 | `category.names.test.ts` `AC14 renaming to its own name, or to it in another letter case, is accepted` | yes |
| C15 | `category.names.test.ts` `AC15 the description keeps its rule and is not checked against the name rules` | yes |
| C16 | `category.tree.test.ts` `AC16 moving under another category takes the whole branch along`; `categories.component.test.ts` `AC16 AC17 moves a branch and answers 200 with the new parentId` | yes |
| C17 | `category.tree.test.ts` `AC17 parentId null makes it a root and keeps its branch`; `categories.component.test.ts` `AC16 AC17 ...` | yes |
| C18 | `category.tree.test.ts` `AC18 a move that would put any category below tier 3 is refused and nothing moves`; `categories.component.test.ts` `AC18 AC19 AC20 AC25 AC13 ...` | yes - all three plan examples |
| C19 | `category.tree.test.ts` `AC19 moving into itself or one of its descendants is refused and nothing moves`; `categories.component.test.ts` `AC18 AC19 AC20 AC25 AC13 ...` | yes |
| C20 | `category.tree.test.ts` `AC20 a new parent that does not exist or is another user's answers Parent category not found`; `categories.component.test.ts` `AC18 AC19 AC20 AC25 AC13 ...` | yes |
| C21 | `category.tree.test.ts` `AC21 a patch with name and parentId applies both, or neither when a rule fails` | yes - the two refusals assert only "an error", but the stored state is asserted afterwards |
| C22 | `category.tree.test.ts` `AC22 deleting removes the category and all its descendants`; `category.migration.test.ts` `AC22 deleting a category deletes its descendants in the database`; `categories.component.test.ts` `AC22 AC23 deletes the branch with 204 and its transactions become uncategorized` | yes - the unit test leans on the mock's cascade; the real cascade is held by the SQLite and component tests |
| C23 | `categories.component.test.ts` `AC22 AC23 deletes the branch with 204 and its transactions become uncategorized` | yes - transactions on root, child and grandchild all come back under `category=none` |
| C24 | `category.tree.test.ts` `AC24 deleting leaves the parent, siblings and other branches unchanged` | yes |
| C25 | `category.tree.test.ts` `AC25 updating, moving or deleting a missing or another user's category answers Category not found`; `categories.component.test.ts` `AC25 answers 404 for a missing or another user's category and 401 without a user`; `AC18 AC19 AC20 AC25 AC13 ...` | yes |
| C26 | `category.tree.test.ts` `AC26 a create writes one category.created record`; `categories.component.test.ts` `AC26 AC27 AC28 AC30 the composed app writes a record per change through its logger` | yes |
| C27 | `category.tree.test.ts` `AC27 a rename writes category.renamed with the new and the previous name` | yes |
| C28 | `category.tree.test.ts` `AC28 a move writes category.moved; a rename and move writes both` | yes |
| C29 | `category.tree.test.ts` `AC29 a description-only patch writes category.updated` | yes for a description change; a patch that changes nothing also writes `category.updated` and no test catches it (finding 2) |
| C30 | `category.tree.test.ts` `AC30 deleting a branch writes one category.deleted record per category removed` | yes - 4 records, each id and name |
| C31 | `category.tree.test.ts` `AC31 a refused create, update, move or delete writes no record` | yes |
| C32 | `category.tree.test.ts` `AC32 descendantIds returns the ids with every descendant of each`; `categories.component.test.ts` `AC32 AC33 a category filter includes its descendants in the list and the balance; none is unchanged` | yes - but `TransactionService`'s expansion is proven only at Component level (finding 3) |
| C33 | `categories.component.test.ts` `AC32 AC33 ...` | yes |
| C34 | `categoryTree.test.tsx` `AC34 AC35 shows Uncategorized, then roots expanded with indented children and children collapsed` | yes |
| C35 | `categoryTree.test.tsx` `AC34 AC35 ...`; `AC35 the toggle shows and hides a category's children` | yes |
| C36 | `categoryTree.test.tsx` `AC36 clicking a category filters by it and the list shows what the API returns for that branch` | yes |
| C37 | `categoryTree.test.tsx` `AC37 Add with a Parent creates it under that parent and shows it nested, parent expanded`; `AC37 Add with None (top level) sends no parentId` | yes |
| C38 | `categoryTree.test.tsx` `AC38 Edit with another Parent moves it and shows its branch in the new place`; `AC38 Edit to None (top level) sends parentId null` | yes |
| C39 | `categoryTree.test.tsx` `AC39 a refused save keeps the dialog open with the API detail` | yes |
| C40 | `categoryTree.test.tsx` `AC40 AC42 deleting a branch shows the count, Cancel removes nothing, Delete removes it and clears the filter` | yes - exact text, Cancel sends nothing, Delete sends one request |
| C41 | `categoryTree.test.tsx` `AC41 deleting a category with no descendants shows the single-category text` | yes |
| C42 | `categoryTree.test.tsx` `AC40 AC42 ...` | yes - the filtered id is a descendant (`restaurants`), so the branch ids are cleared, not only the deleted id |
| C43 | `categoryTree.test.tsx` `AC43 the quick-add Category select lists the tree in order, indented, and any tier can be picked` | yes |
| C44 | `categoryTree.test.tsx` `AC44 transaction rows show the category name at any tier` | yes |
| C45 | `category.migration.test.ts` `AC45 deletes every category, keeps transactions with no category and adds parentId and nameKey` | yes - real migrator, foreign keys on, FK action, NOT NULL and index columns asserted |
| C46 | `categories.component.test.ts` `answers 200 with parentId, 404 for another user and 401 without a user` | yes |
| C47 | `category.names.test.ts` `AC9 AC12 a tab, newline or no-break space at either end is refused, not trimmed` | yes - `Food\t`, `\nFood`, a no-break space at the start and at the end, and `Food\r\n` each must answer the character-rule detail and nothing is saved; with the old `trim()` all five were accepted, so the test fails if the claim is false |
| C48 | `category.tree.test.ts` `AC29 AC31 a patch that changes nothing writes no record` | yes - `{}`, the same name, the same description and the current parent each wrote `category.updated` before the fix, and the test asserts no record at all; `AC29 a description-only patch writes category.updated` still holds the real-change case |
| C49 | `transaction.filter.test.ts` `AC32 listMonth selects the category and every descendant the category service returns`; `AC32 balance counts the category and every descendant`; `AC33 none stays selected beside expanded ids and alone asks for no descendants` | yes - the `descendantIds` stub returns extra ids, so dropping the expansion from `listMonth` (`food` would give only `Lunch`) or `balance` (`-1`, not `-7`) fails, dropping `null` beside ids loses `Loose`, and `asked` proves `none` alone makes no call; unit level, as `testing.md` puts service branches |
| C50 | `category.names.test.ts` `AC9 a name of tens of thousands of spaces is normalised in linear time` | yes - the 500 ms bound fails on the old `/^ +\| +$/` (`a` + 100,000 spaces + `b` took 3,372 ms in a throwaway run, the split and join 3 ms), and the stored names `a b` and `c` hold the trim and collapse; the new `normaliseName` gives the same output as the old one on `  Food   Out `, `Food\t`, `\nFood`, a no-break space at either end, `Food\r\n` and `Tab\tName`, so AC 9 and AC 12 still hold (C47 green at d7be693) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A leading or trailing tab, newline or no-break space is silently removed and the name accepted, where AC 9 trims only spaces and AC 12 refuses any other character | `category.service.ts` `normaliseName` uses `String.prototype.trim()`, which strips all Unicode whitespace. Throwaway test at c23dc7b: `"\tLeading tab"` -> stored `Leading tab`, `"Trailing nl\n"` -> stored `Trailing nl`, `" Nbsp"` -> stored `Nbsp`; inner `"In ner"` -> `400` (so the same character is refused inside but dropped at the ends) | trim only U+0020 at the ends (leading and trailing runs of `/ +/` only) so the character rule refuses the rest, and add `"Food\t"` and `"\nFood"` to the AC 12 refused list; or, if stripping is intended, change AC 9 to say "whitespace" and confirm it |  `0f87e1a` - C47 |
| A patch that changes nothing writes a `category.updated` record, where AC 29 writes it only when the description changes | `category.service.ts` `updateCategory`: the `!renamed && !moved` branch logs regardless of what changed. Throwaway test at c23dc7b: `{ name: <same name> }`, `{ parentId: <current parent> }` and `{}` each wrote `{ event: 'category.updated', ... }`. C29's test only covers a real description change | log `category.updated` only when `patch.description !== undefined` (or the description differs), and add a no-op patch to the AC 29 / AC 31 tests expecting no record |  `0f87e1a` - C48 |
| The descendant expansion in `TransactionService` (`withDescendants`, incl. keeping `none` beside ids) has no unit test; it is proven only at Component level, where `testing.md` puts service branches at Unit | `transaction.service.test.ts` and `transaction.balance.test.ts` stub `descendantIds` as identity (`[...ids]`), so removing the call from `listMonth` or `balance`, or dropping `null` when ids are present, fails no unit test | add a unit test in `transaction/__test__` with a `descendantIds` stub that returns extra ids, asserting `listMonth` and `balance` filter by them and keep `null` when `none` is also selected |  `0f87e1a` - C49 |

Own examples tried at c23dc7b (throwaway, deleted): name length with 30 and 31 decomposed `é` (60/62 code points before NFC) - 30 accepted, 31 refused, as AC 11 says; depth - a root with only children moved under a root `200`, a grandchild moved to the top `200`, a leaf moved under a depth-3 category `400`, the same leaf under a depth-2 category `200`, as AC 18 says; ten-name ordering with accents (`Ångström`, `Éclair`/`eclairs`, `Óscar`/`omega`) correct in both directions.
