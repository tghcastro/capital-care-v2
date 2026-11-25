# Child Categories checks

Build: `pnpm build`; `pnpm type-check`; `pnpm lint`
Run node: `pnpm exec vitest run --project node modules/ledger/src/category apps/api/test/categories.component.test.ts --reporter=verbose 2>&1`
Run web: `pnpm exec vitest run --project web apps/web/src/routes/__test__/categoryTree.test.tsx --reporter=verbose 2>&1`
Plan: `.specs/features/child-categories/plan.md`

46 checks in 10 slices · 5 one-way doors · 0 open

## Checks

### S1 - Build a 3-tier tree

**C1** - A category created with no `parentId` (absent or `null`) is saved with `parentId: null`; `POST /categories` answers `201` with `parentId: null` (AC 1)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: create > AC1 a category with no parentId, absent or null, is a root
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: POST /categories > AC1 AC2 answers 201 with parentId null for a root and the parent id for a child

**C2** - A category created with the id of the user's root or child is saved under it and answers `201` with that `parentId` (AC 2)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: create > AC2 a category created under a root or a child gets that parentId
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: POST /categories > AC1 AC2 answers 201 with parentId null for a root and the parent id for a child

**C3** - Creating under a depth-3 category answers `400` `ValidationError` `maximum depth is 3 tiers` and saves nothing; under depth 2 → `201` (AC 3)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: create > AC3 creating under a grandchild answers maximum depth is 3 tiers and saves nothing
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: POST /categories > AC3 AC4 AC10 AC13 answers 400, 404, 409 and 401 with their detail

**C4** - A `parentId` that is missing or another user's answers `404` `Parent category not found` and saves nothing (AC 4)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: create > AC4 a parentId that does not exist or is another user’s answers Parent category not found
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: POST /categories > AC3 AC4 AC10 AC13 answers 400, 404, 409 and 401 with their detail

**C5** - `GET /categories` answers `200` `{ categories }` with only roots at the top, children nested in `children` to grandchildren, each node with `parentId` (AC 5)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: list > AC5 lists only roots, children nested under them and grandchildren under those, with parentId
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: GET /categories > AC5 AC6 AC7 answers the nested tree, alphabetical at each level, reversed with sort=-name

**C6** - Each level is ordered alphabetically ignoring case and accents (`Apple`, `banana`, `Cherry`; `Dog`, `Éclair`, `Zoo`) and reversed with `sort=-name` (AC 6)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: list > AC6 orders every level alphabetically ignoring case and accents, reversed with -name
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: GET /categories > AC5 AC6 AC7 answers the nested tree, alphabetical at each level, reversed with sort=-name

**C7** - A user with no categories gets `200` `{ categories: [] }` (AC 7)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: list > AC7 a user with no categories gets an empty list
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: GET /categories > AC5 AC6 AC7 answers the nested tree, alphabetical at each level, reversed with sort=-name

**C8** - Only the acting user's categories are listed, nested and accepted as a parent (AC 8)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: list > AC8 lists only the acting user’s categories
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: create > AC4 a parentId that does not exist or is another user’s answers Parent category not found

### S2 - Name rules

**C9** - The name is stored NFC, trimmed, inner space runs collapsed: `"  Food   Out "` → `Food Out` (AC 9)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC9 stores the name normalised: trimmed, inner spaces collapsed, NFC

**C10** - A missing, non-string or blank name on create answers `400` `name is required`; on update absent keeps the name and empty answers the same (AC 10)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC10 a missing, non-string or blank name on create answers name is required
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC10 on update an absent name keeps it and an empty one answers name is required
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: POST /categories > AC3 AC4 AC10 AC13 answers 400, 404, 409 and 401 with their detail

**C11** - 30 characters (`é` × 30 included) are accepted and 31 answer `400` `name must be at most 30 characters`, on create and rename (AC 11)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC11 accepts 30 characters and refuses 31, counting characters not bytes
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC11 the length rule applies to a rename
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: PATCH /categories/:id > AC18 AC19 AC20 AC25 AC13 answers 400, 404, 409 and 401 with their detail and changes nothing

**C12** - `Saúde 2` and `Educação` are accepted; `Food & Drinks`, `Car-Fuel`, a tab, a newline, an emoji and `²` answer `400` `name may contain only letters, digits and spaces`, on create and rename (AC 12)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC12 accepts letters with accents, digits and spaces and refuses anything else
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC12 the character rule applies to a rename
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: POST /categories > AC3 AC4 AC10 AC13 answers 400, 404, 409 and 401 with their detail

**C13** - A name equal in any letter case to another of the user's categories at any tier answers `409` `name is taken` (`FUEL` vs grandchild `Fuel`, `SAÚDE` vs `Saúde`); another user's `Fuel` is accepted; the database key backs it (AC 13)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC13 a name taken in any letter case anywhere in the tree answers name is taken
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC13 renaming to a name another category holds answers name is taken
Proof: run node | ✓ modules/ledger/src/category/__test__/category.migration.test.ts > category table on real SQLite > AC13 the unique key refuses a second row with the same name key and answers name is taken
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: POST /categories > AC3 AC4 AC10 AC13 answers 400, 404, 409 and 401 with their detail

**C14** - Renaming to its own name or to it in another letter case is accepted and stores the new spelling (AC 14)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC14 renaming to its own name, or to it in another letter case, is accepted

**C15** - The description is not checked against the name rules (AC 15)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.names.test.ts > category names > AC15 the description keeps its rule and is not checked against the name rules

### S3 - Move a branch

**C16** - Patching `parentId` to another category moves it with its whole branch and answers `200` with the new `parentId` (AC 16)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: move > AC16 moving under another category takes the whole branch along
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: PATCH /categories/:id > AC16 AC17 moves a branch and answers 200 with the new parentId

**C17** - Patching `parentId: null` makes it a root with its branch, `200` `parentId: null` (AC 17)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: move > AC17 parentId null makes it a root and keeps its branch
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: PATCH /categories/:id > AC16 AC17 moves a branch and answers 200 with the new parentId

**C18** - A move that puts any category of the branch below tier 3 answers `400` `maximum depth is 3 tiers` and moves nothing; a child with one child under a root → `200` (AC 18)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: move > AC18 a move that would put any category below tier 3 is refused and nothing moves
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: PATCH /categories/:id > AC18 AC19 AC20 AC25 AC13 answers 400, 404, 409 and 401 with their detail and changes nothing

**C19** - Moving into itself or a descendant answers `400` `a category cannot be moved into itself or its descendants` and moves nothing (AC 19)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: move > AC19 moving into itself or one of its descendants is refused and nothing moves
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: PATCH /categories/:id > AC18 AC19 AC20 AC25 AC13 answers 400, 404, 409 and 401 with their detail and changes nothing

**C20** - A new parent that is missing or another user's answers `404` `Parent category not found` and moves nothing (AC 20)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: move > AC20 a new parent that does not exist or is another user’s answers Parent category not found
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: PATCH /categories/:id > AC18 AC19 AC20 AC25 AC13 answers 400, 404, 409 and 401 with their detail and changes nothing

**C21** - A patch with `name` and `parentId` applies both, or neither when either rule fails (AC 21)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: move > AC21 a patch with name and parentId applies both, or neither when a rule fails

### S4 - Delete a branch

**C22** - Deleting removes the category and all descendants and answers `204`; the next list holds none of them; the database cascade does it (AC 22)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: delete > AC22 deleting removes the category and all its descendants
Proof: run node | ✓ modules/ledger/src/category/__test__/category.migration.test.ts > category table on real SQLite > AC22 deleting a category deletes its descendants in the database
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: DELETE /categories/:id > AC22 AC23 deletes the branch with 204 and its transactions become uncategorized

**C23** - Transactions of a deleted branch remain and are returned by `category=none` (AC 23)
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: DELETE /categories/:id > AC22 AC23 deletes the branch with 204 and its transactions become uncategorized

**C24** - Deleting leaves the parent, siblings and other branches unchanged (AC 24)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: delete > AC24 deleting leaves the parent, siblings and other branches unchanged

### S5 - Not found and ownership

**C25** - Updating, moving or deleting a missing or another user's category answers `404` `Category not found` and changes nothing (AC 25)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: not found > AC25 updating, moving or deleting a missing or another user’s category answers Category not found
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: DELETE /categories/:id > AC25 answers 404 for a missing or another user’s category and 401 without a user
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: PATCH /categories/:id > AC18 AC19 AC20 AC25 AC13 answers 400, 404, 409 and 401 with their detail and changes nothing

### S6 - Log records

**C26** - A create writes `{ event: 'category.created', userId, categoryId, categoryName, parentId }` (AC 26)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: log records > AC26 a create writes one category.created record
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: category log records > AC26 AC27 AC28 AC30 the composed app writes a record per change through its logger

**C27** - A rename writes `category.renamed` with the new `categoryName` and `previousName` (AC 27)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: log records > AC27 a rename writes category.renamed with the new and the previous name

**C28** - A move writes `category.moved` with `parentId` and `previousParentId`; rename and move writes both (AC 28)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: log records > AC28 a move writes category.moved; a rename and move writes both

**C29** - A description-only patch writes `category.updated` (AC 29)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: log records > AC29 a description-only patch writes category.updated

**C30** - A branch delete writes one `category.deleted` per category removed: 4 for a root with 2 children and 1 grandchild (AC 30)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: log records > AC30 deleting a branch writes one category.deleted record per category removed

**C31** - A refused create, update, move or delete writes no record (AC 31)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: log records > AC31 a refused create, update, move or delete writes no record

### S7 - Filter by a branch

**C32** - A `category` filter on `GET /transactions` and `GET /transactions/balance` includes its descendants: `Food` → Food, Groceries, Fruit; `Groceries` → Groceries, Fruit (AC 32)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.tree.test.ts > category tree: descendants for filters > AC32 descendantIds returns the ids with every descendant of each
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: transactions filtered by a branch > AC32 AC33 a category filter includes its descendants in the list and the balance; none is unchanged

**C33** - `category=none` still returns only occurrences with no category (AC 33)
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: transactions filtered by a branch > AC32 AC33 a category filter includes its descendants in the list and the balance; none is unchanged

### S8 - The tree in the web site

**C34** - The Categories panel shows `Uncategorized`, then roots in API order, children indented `pl-6`, grandchildren `pl-12` (AC 34)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC34 AC35 shows Uncategorized, then roots expanded with indented children and children collapsed

**C35** - Roots load expanded and children collapsed; `Expand <name>` / `Collapse <name>` with `aria-expanded` shows and hides the children (AC 35)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC34 AC35 shows Uncategorized, then roots expanded with indented children and children collapsed
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC35 the toggle shows and hides a category’s children

**C36** - Clicking a category toggles it in the filter and requests `category=<id>` (AC 36)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC36 clicking a category filters by it and the list shows what the API returns for that branch

**C37** - `Add category` with a `Parent` (default `None (top level)`) posts `parentId` and shows it nested with its parent expanded; with None no `parentId` is sent (AC 37)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC37 Add with a Parent creates it under that parent and shows it nested, parent expanded
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC37 Add with None (top level) sends no parentId

**C38** - `Edit <name>` lists every category but itself in `Parent`; changing it patches `parentId` (a category, or `null`) and shows the branch in its new place (AC 38)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC38 Edit with another Parent moves it and shows its branch in the new place
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC38 Edit to None (top level) sends parentId null

**C39** - A refused save keeps the dialog open with the API `detail` in an alert (AC 39)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC39 a refused save keeps the dialog open with the API detail

**C40** - Deleting a branch shows `This permanently removes 4 categories: Food and its 3 subcategories. Their transactions become uncategorized.`; `Cancel` deletes nothing; `Delete` sends one request (AC 40)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC40 AC42 deleting a branch shows the count, Cancel removes nothing, Delete removes it and clears the filter

**C41** - Deleting a leaf shows `This permanently removes this category. Its transactions become uncategorized.` (AC 41)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC41 deleting a category with no descendants shows the single-category text

**C42** - After a delete the branch is gone from the panel and its ids leave the active filter (AC 42)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category tree panel > AC40 AC42 deleting a branch shows the count, Cancel removes nothing, Delete removes it and clears the filter

**C43** - The quick-add `Category` select lists the tree depth-first, indented by tier, and a grandchild can be picked and sent (AC 43)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category picker and rows > AC43 the quick-add Category select lists the tree in order, indented, and any tier can be picked

**C44** - Transaction rows show the category name at any tier (AC 44)
Proof: run web | ✓ src/routes/__test__/categoryTree.test.tsx > category picker and rows > AC44 transaction rows show the category name at any tier

### S9 - Migration

**C45** - Migration `0003` deletes every category, keeps transactions, revisions and settlements with `categoryId` `NULL`, and leaves `parentId` (FK `ON DELETE CASCADE`), `nameKey NOT NULL` and the unique index on `(userId, nameKey)` (AC 45)
Proof: run node | ✓ modules/ledger/src/category/__test__/category.migration.test.ts > migration 0003 > AC45 deletes every category, keeps transactions with no category and adds parentId and nameKey

### S10 - Existing routes keep working

**C46** - `GET /categories/:id` answers `200` with `parentId`, `404` for another user's category and `401` without `X-User-Id` (Surface)
Proof: run node | ✓ apps/api/test/categories.component.test.ts > API app: GET /categories/:id > answers 200 with parentId, 404 for another user and 401 without a user

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /categories` statuses (5) | 201 C1 · 400 C3 C10 C12 · 404 C4 · 409 C13 · 401 C1-component (`AC3 AC4 AC10 AC13` test) | - |
| `PATCH /categories/:id` statuses (5) | 200 C16 C17 · 400 C11 C18 C19 · 404 C20 C25 · 409 C13 · 401 C25-component (`AC18 AC19 AC20 AC25 AC13` test) | - |
| `DELETE /categories/:id` statuses (3) | 204 C22 · 404 C25 · 401 C25 | - |
| `GET /categories` statuses (2) | 200 C5 · 401 C5-component | - |
| `GET /categories/:id` statuses (3) | 200 C46 · 404 C46 · 401 C46 | - |
| Landing doors (5) | parent link C22 C45 · name key C13 C45 · logger seam C26 (composed app) · list contract C5 · migration deletes data C45 | - |
| name rule examples, AC 11 (3) | 30 C11 · 31 C11 · `é` × 30 C11 | - |
| name rule examples, AC 12 (5) | `Saúde 2` C12 · `Educação` C12 · `Food & Drinks` C12 · `Car-Fuel` C12 · tab C12 | - |
| uniqueness examples, AC 13 (3) | grandchild `Fuel` vs `FUEL` C13 · `Saúde` vs `SAÚDE` C13 · other user's `Fuel` C13 | - |
| depth examples, AC 3 and AC 18 (5) | under depth 2 C3 · under depth 3 C3 · root with grandchildren under root C18 · child with child under root C18 · same child under child C18 | - |
| order examples, AC 6 (2) | roots `banana` `Apple` `Cherry` C6 · children `Zoo` `Éclair` `Dog` C6 | - |
| log events (5) | created C26 · renamed C27 · moved C28 · updated C29 · deleted C30 | - |
| filter examples, AC 32 (2) | `Food` C32 · `Groceries` C32 | - |
| web controls (6) | category button C36 · Expand/Collapse C35 · Add category + Parent C37 · Edit + Parent C38 · Delete + Cancel C40 · quick-add Category select C43 | - |
| startup config: logger (1 assembly) | `apps/api` `createApp`, the only composition root, which every component test boots: C26 | - |
| readers of the list contract in code (2) | web panel C34 · web picker C43 | - |

## Swept

- validation: C9-C15, C3, C18, C19
- failure modes: C21 (a refused patch saves nothing); C31
- idempotency: n/a - create is not retried by any client; a repeated create answers `409` `name is taken` (C13)
- authorization: C4, C8, C20, C25; `401` without `X-User-Id` - existing guard in `createCategoryRouter`, asserted in the component tests
- concurrency: C13 - the unique index on `(userId, nameKey)` refuses a second row even when the service check is passed by both requests; two moves racing past the depth check are not guarded (single-user ledger, no lock) - noted, not a criterion
- data lifecycle: C22, C23, C45; a saved name comes back as stored (C9)
- dependency failure: n/a - no external call
- state transitions: n/a - categories have no states
- observability: C26-C31

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none yet
- **Boundary:** C1-C45 closed in the working tree, not yet committed (commit blocked by the permission check earlier in the session)
- **Abandoned:** drizzle-kit's generated `0003` (an `ALTER TABLE ADD` that drops `ON DELETE CASCADE` and adds `nameKey NOT NULL` with no default, which SQLite refuses) - replaced by a hand-written table rebuild
- **Walked:** not yet
- **Not run here:** the Bruno `Categories` folder was updated for the tree, the name rules and the new errors, but not run: building the app and fetching the Bruno CLI were refused by the session's permission check
