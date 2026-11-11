# Category sort descending fix verification

**Verdict**: PASS
**Proofs**: `proofs.md` at 9f3c96f
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `category.repository.sort.test.ts` `sort=-name returns the user categories descending by name` | yes - real SQLite, asserts the exact array `['Zebra','Mango','Apple']` from insertion order Mango, Zebra, Apple; the old callback throws, and a missing ORDER BY would return ascending |
| C2 | `category.repository.sort.test.ts` `sort=-name returns only the requesting user categories` | yes - exact `['Mango','Apple']` with user2's `Zebra` present |
| C3 | `category.repository.sort.test.ts` `sort=-name on a user with no categories returns an empty array` | yes - `toEqual([])` with another user's row present |
| C4 | `category.repository.sort.test.ts` `sort=name returns the user categories ascending by name` | yes - exact `['Apple','Mango','Zebra']` from non-sorted insertion order (see note on the unique index) |

## Findings

None - probed against the real CategoryRepository at HEAD with a throwaway test (deleted): names differing by case (`apple`, `Banana`, `cherry`, `Apple2`) and by accent (`Eclair`, `Éclair`, `eclair`, `Zed`) give an exact reverse of the ascending order under `-name` (SQLite BINARY collation, uppercase before lowercase, `É` last; same as `name`, not claimed by any check); a single category returns `['Solo']`; an unknown sort value (`'bogus'`) and `undefined` reach the repository without error and return `a,b,c` (no ORDER BY / default `name`), and the service already maps any non-`-name` value to `name`. Notes, not findings: (1) `unique(userId, name)` makes a bare scan index-ordered, so C4 would also pass if the ascending `orderBy` were removed; C4 still holds the output it claims, and the descending C1 does discriminate. (2) The mock-based `category.list.test.ts` `sorts descending` still never runs the query; C1 covers that layer. The diff touched only the `desc` import, the `-name` branch and the new test; nothing else is unnamed by a check.
