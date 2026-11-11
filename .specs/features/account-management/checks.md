# Account Management checks

Build: `pnpm type-check; pnpm build`
Run unit: `pnpm build && pnpm exec vitest run modules/ledger/src/account modules/ledger/src/__test__ apps/api/test --reporter=verbose 2>&1`
Plan: `.specs/features/account-management/plan.md`

33 checks in 5 slices · 3 one-way doors · 0 open, of which 0 block

Test files, all new: `modules/ledger/src/account/__test__/account.dto.test.ts` (unit, pure schema), `account.service.test.ts` (unit, in-memory repository), `account.repository.test.ts` and `account.router.test.ts` (integration, real in-memory SQLite with the committed migrations; the router test mounts the router on Express and calls it over HTTP), `modules/ledger/src/__test__/config.test.ts` (unit), `apps/api/test/accounts.component.test.ts` (component, whole app). Every test title starts with its check id.

## Checks

### S1 - Create, list and rename accounts

**C1** - POST `/accounts` with `{ "name": "Bank A account" }` returns `201` with `id` (UUID), `userId`, `name`, `createdAt`, `updatedAt` (ISO 8601 UTC); `"Money"` and `"Credit Card from institution C"` also return `201` (AC S1.1)
Proof: run unit | ✓ C1 POST /accounts returns 201 with the account fields

**C2** - GET `/accounts` for a user with no accounts returns `200` with `{ "accounts": [] }` (AC S1.2)
Proof: run unit | ✓ C2 GET /accounts with no accounts returns an empty list

**C3** - GET `/accounts` returns the caller's accounts and none of another user's (AC S1.3)
Proof: run unit | ✓ C3 GET /accounts returns only the caller accounts

**C4** - The list is ordered alphabetically by name ignoring case and accents: `cash`, `Bank A`, `credit card`, `Bank B`, `Ágata`, `Abc` → `Abc`, `Ágata`, `Bank A`, `Bank B`, `cash`, `credit card` (AC S1.3)
Proof: run unit | ✓ C4 listByUser orders names alphabetically ignoring case and accents

**C5** - PATCH `/accounts/:id` with a valid free name returns `200` with the new name and a later `updatedAt`; `id`, `userId` and `createdAt` are unchanged (AC S1.4)
Proof: run unit | ✓ C5 PATCH /accounts/:id renames and keeps id userId createdAt

**C6** - Renaming an account to its own name returns success: `Cash` → `Cash`, and `cash` → `Cash` on the same account saves `Cash` (AC S1.5)
Proof: run unit | ✓ C6 rename to its own name or only its casing succeeds

**C7** - PATCH with no `name` or an empty `name` returns `400` and leaves the account unchanged: `{}` → `400`, `{ "name": "" }` → `400` (AC S1.6)
Proof: run unit | ✓ C7 PATCH without a usable name returns 400 and changes nothing

### S2 - Account name rules

**C8** - A missing, empty or only-spaces name is rejected by the name rule: no `name`, `""`, `"   "` (AC S2.1)
Proof: run unit | ✓ C8 name rule rejects a missing empty or blank name

**C9** - The length bound is 30: 30 characters accepted, 31 rejected with a message naming the maximum (AC S2.2)
Proof: run unit | ✓ C9 name rule accepts 30 characters and rejects 31

**C10** - Only letters of any language, digits and spaces are accepted: `Bank-A`, `Card #2`, `Money 💰`, `a_b`, `a.b`, a tab inside the name are rejected; `Conta Poupança`, `Cartão 2`, `Σ Bank` are accepted (AC S2.3)
Proof: run unit | ✓ C10 name rule accepts letters digits and spaces only

**C11** - Leading and trailing spaces are trimmed before validating and saving: `"  Cash  "` is saved as `"Cash"`; a name of 30 characters plus surrounding spaces is accepted; 31 characters plus surrounding spaces is rejected (AC S2.4)
Proof: run unit | ✓ C11 name is trimmed before the rules apply

**C12** - POST and PATCH with an invalid name return `400` with a `detail` naming the broken rule, and nothing is saved (AC S2.1-S2.3)
Proof: run unit | ✓ C12 invalid names return 400 with the rule and save nothing

### S3 - Names are unique per user, ignoring case

**C13** - Creating an account whose name matches one of the user's own ignoring case is rejected with a name-taken conflict: `Cash` then `cash`, `Poupança` then `POUPANÇA`; `Cash` then `Cash 2` is accepted (AC S3.1)
Proof: run unit | ✓ C13 create rejects a name taken ignoring case

**C14** - Renaming to a name another of the user's accounts has, ignoring case, is rejected and both accounts stay unchanged (AC S3.2)
Proof: run unit | ✓ C14 rename rejects a name taken by another account

**C15** - The stored data rejects two accounts of one user with the same name ignoring case even when the service check is bypassed, as a name-taken conflict; the same name for a different user is accepted (AC S3.1, S3.3; door 1)
Proof: run unit | ✓ C15 unique key rejects a duplicate name ignoring case with a conflict

**C16** - Two different users each creating `Cash` both get `201` (AC S3.3)
Proof: run unit | ✓ C16 two users can each create Cash

**C17** - After an account is deleted its name is free for the same user again: create `Cash`, delete it, create `Cash` → `201` (AC S3.4)
Proof: run unit | ✓ C17 a deleted account name can be used again

**C18** - POST and PATCH return `409` with body `{ type: "ConflictError", detail }` for a taken name, and the same for a reached limit (AC S3.1, S3.2, S4.1)
Proof: run unit | ✓ C18 conflicts return 409 with a ConflictError body

### S4 - The account limit is a system setting

**C19** - With limit 5: 4 accounts → create succeeds; 5 accounts → create is rejected with a conflict whose message states `5`, and nothing is saved (AC S4.1)
Proof: run unit | ✓ C19 create is rejected at the limit and the message states it

**C20** - A user at the limit who deletes an account can create again (AC S4.2)
Proof: run unit | ✓ C20 deleting an account at the limit frees a slot

**C21** - The limit applies per user: two users with 5 accounts each are both blocked, a third user with none can create (AC S4.3)
Proof: run unit | ✓ C21 the limit counts each user separately

**C22** - With limit 5 and a user holding 7 accounts: the list returns all 7, create is rejected, create is still rejected at exactly 5, and create succeeds at 4 (AC S4.4)
Proof: run unit | ✓ C22 a lowered limit keeps existing accounts and blocks new ones

**C23** - `ACCOUNT_LIMIT` unset gives 99; `"5"` gives 5; `"1"` gives 1; `"99"` gives 99 (AC S4.5)
Proof: run unit | ✓ C23 account limit defaults to 99 and reads valid values

**C24** - A set but invalid `ACCOUNT_LIMIT` makes configuration loading throw an error naming `ACCOUNT_LIMIT`: `"0"`, `"-3"`, `"2.5"`, `"abc"`, `""`, `"5abc"`, `"1e1"` (AC S4.6)
Proof: run unit | ✓ C24 invalid account limit fails with the variable name

**C25** - The ledger module and the API app both refuse to start with an invalid `ACCOUNT_LIMIT` (AC S4.6)
Proof: run unit | ✓ C25 the app fails to start with an invalid account limit
Proof: run unit | ✓ C25 createLedgerRouters fails to start with an invalid account limit

**C26** - The development setup sets the limit to 5 and the production setup does not set it: `.env.example` and `docker-compose.dev.yml` carry `ACCOUNT_LIMIT` 5, `docker-compose.prd.yml` and `docker-compose.yml` do not mention it (AC S4.7)
Proof: `grep -q '^ACCOUNT_LIMIT=5$' .env.example && [ "$(grep -c 'ACCOUNT_LIMIT: "5"' docker-compose.dev.yml)" -ge 1 ] && ! grep -q ACCOUNT_LIMIT docker-compose.prd.yml docker-compose.yml`

**C27** - A `limit` field in a POST or PATCH body is ignored: with limit 5, bodies carrying `limit: 1000` cannot raise the cap, and no route exposes the limit (AC S4.8)
Proof: run unit | ✓ C27 a limit field in the request body is ignored

### S5 - Delete accounts and ownership

**C28** - DELETE of an owned account returns `204`, removes it permanently and it is gone from the list (AC S5.1)
Proof: run unit | ✓ C28 DELETE /accounts/:id returns 204 and removes the account

**C29** - PATCH and DELETE of an id that does not exist return `404`; a second DELETE of the same id also returns `404`; nothing changes (AC S5.2)
Proof: run unit | ✓ C29 PATCH and DELETE of a missing account return 404

**C30** - PATCH and DELETE of another user's account return `404`, never `403`, and the account is unchanged (AC S5.3)
Proof: run unit | ✓ C30 another user account returns 404 for PATCH and DELETE

**C31** - A request without `X-User-Id` returns `401` on POST, GET, PATCH and DELETE (AC S5.4)
Proof: run unit | ✓ C31 a request without X-User-Id returns 401

**C32** - The API app serves `/accounts`: a POST with a user header to the app returns `201` (Shape hop 4)
Proof: run unit | ✓ C32 the app mounts /accounts

**C33** - The stored data has the table `account` and the unique index `account_userId_nameKey_unique` (door 3, door 1)
Proof: run unit | ✓ C33 the account table and its unique index exist

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /accounts` statuses (4) | 201 C1 · 400 C12 · 409 C18 · 401 C31 | - |
| `GET /accounts` statuses (2) | 200 C2, C3 · 401 C31 | - |
| `PATCH /accounts/:id` statuses (5) | 200 C5 · 400 C7, C12 · 404 C29, C30 · 409 C18 · 401 C31 | - |
| `DELETE /accounts/:id` statuses (3) | 204 C28 · 404 C29, C30 · 401 C31 | - |
| `Account` response fields (5) | `id` C1 · `userId` C1 · `name` C1 · `createdAt` C1 · `updatedAt` C1 | - |
| name examples, AC S2 (15) | `Conta Poupança` C10 · `Cartão 2` C10 · `Σ Bank` C10 · 30 chars C9 · `Cash` padded C11 · `Bank-A` C10 · `Card #2` C10 · `Money 💰` C10 · `a_b` C10 · `a.b` C10 · tab C10 · 31 chars C9 · missing C8 · `""` C8 · `"   "` C8 | - |
| uniqueness examples, AC S3 (4) | `Cash`/`cash` C13 · `Poupança`/`POUPANÇA` C13, C15 · `Cash`/`Cash 2` C13 · different users C16 | - |
| limit examples, AC S4.1-S4.4 (5) | 4 accounts C19 · 5 accounts C19, C22 · 7 accounts C22 · delete frees a slot C20 · per user C21 | - |
| `ACCOUNT_LIMIT` values (11) | unset C23 · `5` C23 · `1` C23 · `99` C23 · `0` C24 · `-3` C24 · `2.5` C24 · `abc` C24 · `""` C24 · `5abc` C24 · `1e1` C24 | - |
| startup config: `ACCOUNT_LIMIT` (2 assemblies) | `createLedgerRouters` in the ledger module C25 · `createApp` in apps/api C25 | - |
| one-way doors (3) | case-insensitive unique key C15, C33 · `ACCOUNT_LIMIT` contract C23, C24, C26 · table and route naming C32, C33 | - |

## Swept

- validation: C8, C9, C10, C11, C12, C24
- failure modes: C24, C25
- idempotency: C6, C29
- authorization: C30, C31
- concurrency: C15 - the unique key rejects a duplicate that slipped past the service check; the limit check and insert run in one synchronous step in a single process (plan Assumptions)
- data lifecycle: C17, C28, C11
- dependency failure: n/a - no external call in this feature
- state transitions: n/a - an account has no states
- observability: n/a - no logging requirement in this feature

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none yet
- **Boundary:** C1-C33 built, tests green at `6c2f4a1`
- **Abandoned:** none
- **Notes:** `pnpm lint` fails before any change because ESLint 10 does not read `.eslintrc.json`, so `Build:` runs type-check and build only. CI runs only `modules/ledger` tests, so C25 and C32 in `apps/api/test` run here but not in the current CI job.
