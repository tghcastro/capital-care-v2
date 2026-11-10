# Database

## Engine & Driver

- **SQLite** to start (zero infra, file-based, nothing to run locally).
- **Driver:** `better-sqlite3` (synchronous, simple API, and a common Drizzle pairing).
- SQLite is the only supported database. Use SQLite features and constraints where they best fit the application; database portability is not a requirement.
- **Location:** migrations live inside `modules/ledger/src/shared/persistence/migrations`, not `packages/shared` — migrations are a backend-only concern. The Web app never touches the DB schema directly; it only ever talks to the API (see [architecture.md](./architecture.md)).
- **Migration workflow:** generate SQL migrations with Drizzle Kit (`pnpm db:generate`), review and commit them to source control. Pending migrations are applied by an explicit, separate command (`node dist/migrate.js`, exposed as `pnpm db:migrate`), which runs immediately before the server starts. In the container image this is the start command (`migrate && start`), so every environment, including the ephemeral DEV database, is migrated the same way. The server itself (`main.ts`) never changes the schema.
- **Foreign keys:** enable SQLite foreign-key enforcement (`PRAGMA foreign_keys = ON`) on every database connection, including test connections.
- **Backups:** use SQLite's backup mechanism to create consistent backups. Do not copy the live database file directly while the application may be writing to it.
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

## Money / Amount Storage

- Monetary amounts are currency-agnostic decimal numbers; no currency is assigned or inferred. SQLite does not provide a fixed-precision decimal storage type, and its `NUMERIC` affinity can store values as `REAL` (floating point), risking rounding errors. Store amounts as **`TEXT`** in canonical base-10 notation: no exponent or leading `+`, no leading zeros in the integer part except for zero itself, no trailing zeros in the fractional part, and zero is stored as `0`. Do not use native `NUMERIC`/`REAL` or apply currency-specific scale/rounding. Any additional amount constraints must come from the business requirements.
- See [architecture.md](./architecture.md#db-types-vs-domain-types) for how this storage value maps to the application-layer `Decimal` type and arithmetic rule.

## IDs

- **UUID** for all entity primary keys (not auto-increment integers), stored as `TEXT` because SQLite has no native UUID type.

## Date & Time

- Store timestamps as SQLite **INTEGER** Unix epoch milliseconds using Drizzle's `timestamp_ms` mode; represent them as JavaScript `Date` values in the application. This records an absolute instant independent of the machine's timezone. Serialize API timestamps as ISO 8601 UTC strings with millisecond precision (for example, `2026-10-29T17:10:33.208Z`). Local-time conversion is presentation-only, never part of storage or business logic.

## Deletion

- Records are hard-deleted by default; do not add `deletedAt` fields or default soft-delete filters. Any retention requirement must be explicitly specified in the relevant business rules.
- Preserve foreign-key integrity when deleting related records. Cascading deletion or retention behavior for related records must be specified by the relevant business rules rather than assumed.

## Timestamps

- `createdAt`/`updatedAt` are `Date` values in domain types and stored as INTEGER epoch milliseconds. They are set explicitly by the application layer (service/repository), not via DB column defaults or triggers. The DB stays "dumb," keeping timestamp behavior explicit in application code.

## Uniqueness & Constraints

- Uniqueness rules are checked in the **application/service layer first** to return a clear conflict error.
- Enforce business uniqueness invariants with SQLite unique constraints as well. This is a data-integrity backstop if requests overlap; no application-level FIFO write queue is required. Translate a unique-constraint violation into the same domain conflict error rather than exposing the SQLite error.

## Transaction Atomicity

- Any repository operation that performs **more than one write** (across one or more tables) as a single business operation must be wrapped in a SQLite transaction (`db.transaction(...)` in Drizzle). A single-row, single-table write does not need one; the DB already guarantees that atomically.

## ORM / Data Access

- **Drizzle**
- Rationale: SQL-like and explicit — matches interest in later experimenting with security topics (e.g. SQL injection) using this project, since Drizzle doesn't hide the generated SQL the way a fully abstracted ORM would.

## Test Database

- See [testing.md](./testing.md) for the test database isolation strategy.
