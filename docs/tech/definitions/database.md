# Database

## Engine & Driver

- **SQLite** to start (zero infra, file-based, nothing to run locally).
- **Driver:** `better-sqlite3` for SQLite (synchronous, simplest API, most common Drizzle pairing). When migrating to PostgreSQL, use `postgres.js` (modern, promise-native, well documented with Drizzle).
- **Constraint:** the application must not be hard-coded to SQLite — switching to PostgreSQL later should require changing the Drizzle driver/connection config, not rewriting business logic.
- **Caveat:** Drizzle schemas are close to raw SQL, which makes a dialect switch easier than with a heavier ORM, but it is **not zero-cost** — SQLite and PostgreSQL don't support identical column types/constraints (e.g. limited `ALTER TABLE` in SQLite), so some migrations may need dialect-specific adjustments. Avoid SQLite-only SQL features in hand-written queries to minimize migration friction. *(Not yet validated in practice — revisit once/if a real migration happens.)*
- **Location:** migrations live inside `modules/ledger/shared/persistence/migrations`, not `packages/shared` — migrations are a backend-only concern. The Web app never touches the DB schema directly; it only ever talks to the API (see [architecture.md](./architecture.md)).
- **Schema ownership:** each aggregate folder owns its own table definition (e.g. `account/account.entity.ts`), per the module/aggregate layout in [architecture.md](./architecture.md#api-layering--composition). `shared/persistence/schema.ts` is only a barrel re-exporting every aggregate's entity file, giving `drizzle-kit` one entry point to generate migrations from:
  ```ts
  // modules/ledger/shared/persistence/schema.ts
  export * from '../../user/user.entity';
  export * from '../../account/account.entity';
  export * from '../../category/category.entity';
  export * from '../../transaction/transaction.entity';
  ```

## Entity & Table Naming (State Isolation)

- **One table, one owning aggregate.** A table is created and written only by its owning aggregate's repository; other aggregates never query or join it directly — they go through that aggregate's service (see [architecture.md](./architecture.md#api-layering--composition)).
- **Aggregate-prefixed names**, even where not currently ambiguous, so a future table never collides with another aggregate's: the Drizzle table variable and the SQL table name both start with the owning aggregate's name (e.g. `account.entity.ts` exports `accountTable` → SQL table `account`; a later "history" table belongs to one aggregate only, e.g. `transactionHistoryTable` → `transaction_history`, never a generic shared `historyTable`).
- This is a single-database project (see Engine & Driver above) — unlike a fully isolated module, tables aren't split across separate connections/databases. The isolation here is **ownership and naming discipline within one DB**, not physical separation.

## Cross-Dialect Type Differences

- The mapper pattern (see [architecture.md](./architecture.md#db-types-vs-domain-types)) applies to any column type/constraint that isn't identical across SQLite and PostgreSQL. Prefer the common-denominator column type (e.g. `TEXT`/`INTEGER`) on both dialects, and represent the richer, dialect-specific concept only in the application layer, converted at the repository boundary. Examples:
  - **Enums:** never use a DB-native `ENUM` column (Postgres has one, SQLite doesn't). Store a `TEXT`/`INTEGER` column and map to/from the domain enum/union type in the repository.
  - Apply the same reasoning to any other type later found to differ (e.g. native `JSON`/`JSONB` support, `BOOLEAN` storage, date/time precision) — store the lowest-common-denominator representation, map to the richer domain type in the mapper.

## Money / Amount Storage

- Monetary amounts are a **decimal**, but SQLite has no native fixed-precision decimal type — its `NUMERIC` affinity can silently store values as `REAL` (floating point), risking rounding errors, unlike PostgreSQL's true arbitrary-precision `NUMERIC`/`DECIMAL`. To get identical, precision-safe behavior on both dialects, store amounts as a **`TEXT`** column (a decimal string), never native `NUMERIC`/`REAL`.
- See [architecture.md](./architecture.md#db-types-vs-domain-types) for how this storage value maps to the application-layer `Decimal` type and arithmetic rule.

## IDs

- **UUID** for all entity primary keys (not auto-increment integers). Stored as `TEXT` on both dialects (SQLite has no native UUID type; PostgreSQL's `uuid` type is also fine, but `TEXT` keeps the column identical across dialects per the Cross-Dialect rule above).

## Date & Time

- All timestamps are stored and processed in **UTC**, never local time. The app may run in different timezones, so any local-time conversion only happens at the presentation boundary (API response formatting / future Web display), never in storage or business logic.

## Soft Deletes

- Convention: `deletedAt: timestamp | null`. `null` = active, non-null = deleted.
- Repositories filter `deletedAt IS NULL` by default for every read; callers never need to add that filter themselves (same encapsulation principle as [DB Types vs Domain Types](./architecture.md#db-types-vs-domain-types)).

## Timestamps

- `createdAt`/`updatedAt` are set explicitly by the application layer (service/repository), not via DB column defaults or triggers. The DB stays "dumb" — no logic lives in it — and behavior is identical across dialects without relying on dialect-specific default/trigger syntax.

## Uniqueness & Constraints

- Uniqueness rules are validated in the **application/service layer first**, before the repository is called — invalid input must fail fast, not wait for a DB error to surface it.
- A DB-level unique index is added **only when the same constraint definition works identically on both SQLite and PostgreSQL**. If a constraint's syntax/behavior would differ across dialects, skip the DB-level constraint for now and rely on the app-layer check alone (same dialect-gap handling as Cross-Dialect Type Differences above).

## Transaction Atomicity

- Any repository operation that performs **more than one write** (across one or more tables) as a single business operation must be wrapped in a DB transaction (`db.transaction(...)` in Drizzle — same API on both SQLite and PostgreSQL). A single-row, single-table write does not need one; the DB already guarantees that atomically.

## ORM / Data Access

- **Drizzle**
- Rationale: SQL-like and explicit — matches interest in later experimenting with security topics (e.g. SQL injection) using this project, since Drizzle doesn't hide the generated SQL the way a fully abstracted ORM would.

## Test Database

- See [testing.md](./testing.md) for the test database isolation strategy.
