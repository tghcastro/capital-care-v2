# Checklist: database

Source: [`docs/tech/definitions/database.md`](../../../../../docs/tech/definitions/database.md).

1. **Migrations.** Schema changes come with a Drizzle Kit migration under `modules/ledger/src/shared/persistence/migrations`; the server never changes the schema. A hand-edited migration that no longer matches the entity. → `#engine--driver`.
2. **Destructive migrations.** Dropped or renamed tables/columns: is data preserved (copy into `__new_` table, then rename)? Foreign keys still valid? (The human-approval gate also flags these.) → `#deletion`.
3. **Table ownership and naming.** A repository querying or joining another aggregate's table; table variable or SQL name without the aggregate prefix. → `#entity--table-naming-state-isolation`.
4. **Money.** Amounts stored as anything but canonical `TEXT`; `REAL`/`NUMERIC` columns; currency scale or rounding applied. → `#money--amount-storage`.
5. **IDs.** Primary keys not UUID `TEXT`. → `#ids`.
6. **Time.** Timestamps not `timestamp_ms` integers; API dates not ISO 8601 UTC with milliseconds; local time in storage or logic. → `#date--time`.
7. **Deletion.** `deletedAt` columns or soft-delete filters; cascades not specified by business rules. → `#deletion`.
8. **Timestamps set by the app.** `createdAt`/`updatedAt` via DB defaults or triggers. → `#timestamps`.
9. **Uniqueness.** A business-unique field without both the service check and a unique constraint; a raw SQLite constraint error reaching the client. → `#uniqueness--constraints`.
10. **Atomicity.** More than one write in one business operation without `db.transaction(...)`. → `#transaction-atomicity`.
11. **Foreign keys.** A new connection without `PRAGMA foreign_keys = ON`. → `#engine--driver`.
