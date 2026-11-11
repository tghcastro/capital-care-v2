# category-sort-desc-fix proofs

**HEAD**: f4d1dcd
**Tree**: clean
**Shell**: /bin/sh
**Result**: 6 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run unit / ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listBy` | pass |
| C2 | `run unit / ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listBy` | pass |
| C3 | `run unit / ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listBy` | pass |
| C4 | `run unit / ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listBy` | pass |
| Build | `pnpm build` | pass |
| Build | `pnpm type-check` | pass |

## Output

`Run unit` - exit 0

```
RUN  v5.1.0 /home/user/capital-care-v2

 ✓ modules/ledger/src/category/__test__/category.list.test.ts > Category List > GET /categories returns all user categories sorted by name asc PASS 18ms
 ✓ modules/ledger/src/category/__test__/category.list.test.ts > Category List > GET /categories?sort=-name sorts descending PASS 1ms
 ✓ modules/ledger/src/category/__test__/category.list.test.ts > Category List > GET /categories with no categories returns empty array PASS 1ms
 ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=name returns the user categories ascending by name 18ms
 ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=-name returns the user categories descending by name 3ms
 ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=-name returns only the requesting user categories 3ms
 ✓ modules/ledger/src/category/__test__/category.repository.sort.test.ts > CategoryRepository.listByUser sort (real SQLite) > sort=-name on a user with no categories returns an empty array 2ms

 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  11:53:13
   Duration  618ms (import 81%, tests 9%, transform 6%, worker 4%)
```
