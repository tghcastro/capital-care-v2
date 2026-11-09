# Category Management - Checks

Build: `npm run build`

Run unit: `npm test -- modules/ledger/src/category/__test__/category.create.test.ts modules/ledger/src/category/__test__/category.uniqueness.test.ts modules/ledger/src/category/__test__/category.list.test.ts modules/ledger/src/category/__test__/category.update.test.ts modules/ledger/src/category/__test__/category.delete.test.ts --reporter=verbose 2>&1`

## Checks

### S1 - Create and retrieve

**C1** - POST `/categories` with name and optional description returns `201` with full `Category` DTO.
Proof: run unit | create with name only PASS

**C2** - POST `/categories` with valid inputs stores `createdAt` and `updatedAt` as ISO 8601 UTC strings.
Proof: run unit | timestamps serialized as ISO 8601 PASS

**C3** - GET `/categories/:id` returns `200` with full category when user owns it.
Proof: run unit | fetch owned category PASS

**C4** - GET `/categories/:id` returns `404 NotFoundError` when user does not own it.
Proof: run unit | fetch unowned category returns 404 PASS

**C5** - POST without `name` field returns `400 ValidationError` with `detail` field.
Proof: run unit | create without name returns 400 PASS

**C6** - POST with name exceeding 255 characters returns `400 ValidationError`.
Proof: run unit | create with name > 255 chars returns 400 PASS

### S2 - Uniqueness and conflict handling

**C7** - POST with identical name as existing category (same user) returns `409 ConflictError`.
Proof: run unit | user cannot create duplicate name PASS

**C8** - POST with identical name as existing category (different user) returns `201` (no conflict).
Proof: run unit | different users can share name PASS

**C9** - PATCH to rename category to name already in use by same user returns `409 ConflictError`.
Proof: run unit | PATCH rename collision returns 409 PASS

### S3 - List and sort

**C10** - GET `/categories` returns `200` with all user's categories sorted by name ascending (default).
Proof: run unit | GET /categories returns all user categories sorted by name asc PASS

**C11** - GET `/categories?sort=-name` returns categories sorted by name descending.
Proof: run unit | GET /categories?sort=-name sorts descending PASS

**C12** - GET `/categories` for user with no categories returns `200` with empty `categories` array.
Proof: run unit | GET /categories with no categories returns empty array PASS

### S4 - Update

**C13** - PATCH `/categories/:id` with `{ name: "new" }` updates name only; description unchanged.
Proof: run unit | PATCH updates name only PASS

**C14** - PATCH `/categories/:id` with `{ description: "new" }` updates description only; name unchanged.
Proof: run unit | PATCH updates description only PASS

**C15** - PATCH with empty object `{}` returns `200` with category unchanged.
Proof: run unit | PATCH with empty object returns unchanged PASS

**C16** - PATCH `/categories/:id` for unowned category returns `404 NotFoundError`.
Proof: run unit | PATCH unowned category returns 404 PASS

### S5 - Delete

**C17** - DELETE `/categories/:id` with no referencing transactions returns `204 No Content` and removes category.
Proof: run unit | DELETE removes category with no transactions PASS

**C18** - DELETE `/categories/:id` for category with transactions returns `409 ConflictError`.
Proof: run unit | DELETE category with transaction returns 409 PASS

**C19** - DELETE `/categories/:id` for unowned category returns `404 NotFoundError`.
Proof: run unit | DELETE unowned category returns 404 PASS

## Coverage

| Set (size) | Member → proof | Unproven |
| --- | --- | --- |
| Response on POST /categories (4) | 201 C1 · 400 C5 · 400 C6 · 409 C7 | - |
| Response on GET /categories/:id (2) | 200 C3 · 404 C4 | - |
| Response on GET /categories (1) | 200 C10, C11, C12 | - |
| Response on PATCH /categories/:id (2) | 200 C13, C14, C15 · 404 C16 | - |
| Response on DELETE /categories/:id (3) | 204 C17 · 409 C18 · 404 C19 | - |
| Per-user uniqueness constraint (3) | new user different name C1 · same user duplicate C7 · different user same name C8 | - |
| PATCH rename uniqueness (1) | collision with own category C9 | - |
| Sort orders (2) | ascending (default) C10 · descending (?sort=-name) C11 | - |
| Partial PATCH updates (2) | name only C13 · description only C14 | - |
| Delete guard: in-use check (1) | FK reference blocks deletion C18 | - |

## Swept

- validation: C5, C6 (name required, max 255 chars), C15 (empty object accepted)
- failure modes: Unique constraint violation handled via 409 (C7, C9)
- idempotency: GET and DELETE are safe to retry; PATCH with empty object idempotent (C15)
- authorization: All endpoints scoped to current user via `X-User-Id` header (C4, C16, C19 return 404 for unowned)
- concurrency: Unique index `(userId, name)` at DB layer prevents concurrent duplicate creates (C7)
- data lifecycle: Timestamps stored as epoch ms, serialized as ISO 8601 on read (C2); hard delete with no archival (C17)
- dependency failure: FK check prevents deletion of in-use category (C18)
- state transitions: C1, C17 (POST creates, DELETE removes)
- observability: n/a - standard HTTP semantics; errors include `detail` field per API spec

## Handoff

**Build phase complete**: ✅ Build passes, implementation done, tests written
**Dispatched to Verifier**: (ready for verification phase)

