# Category sort descending fix checks

Build: `pnpm build`; `pnpm type-check`
Run unit: `pnpm exec vitest run modules/ledger/src/category/__test__/category.repository.sort.test.ts modules/ledger/src/category/__test__/category.list.test.ts --reporter=verbose 2>&1`

## Intent

`GET /categories?sort=-name` answers `500 RangeError: Too few parameter values were provided`
because `CategoryRepository.listByUser` orders with an invalid callback
(`orderBy((t) => ({ desc: t.name }))`), which Drizzle turns into an unbound SQL parameter. The
existing descending test runs against a mock repository, so it never executed the query. After
the fix, `?sort=-name` returns `200` with the user's categories ordered by name descending, and
`?sort=name` is unchanged.

1 slice · 4 checks · 0 one-way doors · 0 open

## Checks

### S1 - Descending sort on the real repository

**C1** - `listByUser(user, '-name')` against real SQLite returns `['Zebra', 'Mango', 'Apple']` for seeded Mango, Zebra, Apple, and does not throw.
Proof: run unit | ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=-name returns the user categories descending by name

**C2** - `listByUser(user1, '-name')` returns only user1's categories (`['Mango', 'Apple']`) when user2 also owns one.
Proof: run unit | ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=-name returns only the requesting user categories

**C3** - `listByUser(user, '-name')` for a user with no categories returns `[]`.
Proof: run unit | ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=-name on a user with no categories returns an empty array

**C4** - `listByUser(user, 'name')` still returns `['Apple', 'Mango', 'Zebra']` ascending (no regression).
Proof: run unit | ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=name returns the user categories ascending by name

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| Sort values on `GET /categories` (2) | `name` C4 · `-name` C1 | - |
| `-name` input space (3) | many categories C1 · other user's rows present C2 · no rows C3 | - |

## Swept

- validation: existing - `CategoryService.listCategories` maps any `sort` other than `-name` to `name`, so no other value reaches the query
- failure modes: C1 (the 500 itself)
- idempotency: n/a - read-only GET
- authorization: C2 (listing stays scoped to the requesting user)
- concurrency: n/a - read-only GET
- data lifecycle: n/a - nothing stored or changed
- dependency failure: n/a - local SQLite only
- state transitions: n/a - none
- observability: n/a - no logging requirement; the error handler already reports the 500

## Handoff

- **Settled mid-build:** none
- **Dispatched:** Verifier at `c25903e` (fix commit) - returned PASS, no findings
- **Boundary:** C1-C4 closed at `c25903e`
- **Abandoned:** none
