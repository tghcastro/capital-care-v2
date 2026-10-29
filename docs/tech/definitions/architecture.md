# Architecture

## Language & Runtime

- **TypeScript** on **Node.js**
- Rationale: strong agent-workflow fit (compiler gives immediate, tool-visible feedback; dense training data for idiomatic generation); schema-as-code tooling (Drizzle, Zod) keeps DB/validation/types in sync.
- **Node version pinning:** the required Node version is locked via `.nvmrc` and `engines` in `package.json` (current LTS), so all environments (local, CI) run the same runtime and avoid version-drift bugs.
- **TypeScript strictness:** `strict: true` in `tsconfig.json`. Catches null/undefined and implicit-`any` bugs at compile time instead of runtime, which also tightens the agent feedback loop (more real errors surface immediately via the compiler/`get_errors`, so generated code is verified harder before it's ever run).

## Repository Structure

Monorepo, single repository for API and (future) Web:

```
capital-care/
  docs/                 # project documents (tech decisions)
  apps/
    api/                 # thin bootstrap only — wires express, mounts module routers
    web/                 # future web client
  modules/
    ledger/               # the module: all Capital Care business logic lives here
  packages/
    shared/               # shared code you own: types, Zod schemas, API client
  package.json            # workspace root
```

`modules/` holds **modules** — bounded, independent business domains (see API Layering & Composition below); this is distinct from `packages/`, which holds only cross-cutting code this project owns and maintains (e.g. `packages/shared`) and is not where third-party dependencies live. Third-party dependencies always install into `node_modules`, regardless of package manager, and should be excluded from agent/editor search (`.gitignore` + VS Code `files.exclude`/`search.exclude`) so they never consume agent context or tokens.

- **App boundary rule:** `apps/web` only ever talks to `apps/api` over HTTP — it never imports from `modules/ledger` or touches the DB directly, even though both apps live in the same monorepo (see [database.md](./database.md) for the matching DB-side statement of this rule).

## Package Manager / Workspace Tool

- **pnpm workspaces**
- Dependencies are still installed into each package's local `node_modules` (pnpm uses a global content-addressable store and symlinks to avoid duplicating files on disk), but this is independent of agent context cost — that's controlled by excluding `node_modules` from search/indexing, not by the choice of package manager.

## API Layering & Composition

- **Apps = bootstraps, modules = logic.** `apps/api` only wires Express and mounts routers; all business logic lives in `modules/<module>/`. Capital Care is one bounded context today, so there is a single module, `modules/ledger/`, holding one folder per **aggregate** (business entity: `user/`, `account/`, `category/`, `transaction/`):
  ```
  modules/ledger/
    user/                       # aggregate — same shape repeats for account/, category/, transaction/
      user.entity.ts            # Drizzle table definition
      user.repository.ts        # DB access; maps row ↔ domain type (see below)
      user.service.ts           # business logic: validation, uniqueness checks, orchestration
      user.controller.ts        # req/res ↔ service calls + Express route binding (no separate route file)
      user.types.ts             # domain type
      user.dto.ts               # Zod schemas
      __test__/                 # unit specs for this aggregate
    shared/
      persistence/
        client.ts                # DB connection only — no repositories here
      errors.ts                  # shared custom error classes
    ledger.facade.ts             # pure delegation to services — no logic
    config.ts                    # module-level config (e.g. connection name, env lookups)
    index.ts                     # exports only the facade + the routers apps/api mounts
  ```
  ```
  apps/api/src/
    middleware/   # error handler, current-user resolver, helmet, etc. — HTTP wiring, not module business logic
    app.ts        # composition root — wires express(), mounts modules/ledger's routers
  ```
- Within an aggregate, the call chain still only calls the layer directly below it (controller → service → repository).
- **Boundary rule:** an aggregate may call another aggregate's `service` only, never its `repository` directly — keeps each aggregate's table(s)/queries encapsulated. Example: `transaction.service.ts` calls `accountService.getById(...)`, never `accountRepository`. See [database.md](./database.md#entity--table-naming-state-isolation) for the matching table-ownership/naming rule.
- **`index.ts` exports only the facade + routers (+ the types needed to use them).** `ledger.facade.ts` is for in-process/same-module callers; the routers are the pragmatic Express equivalent of what a NestJS module would auto-register from controller decorators. Domain types (e.g. `User`) are exported too, since callers need to know the shape of what the facade/router returns — repositories, services, and entities are never imported from outside `modules/ledger`.
- **Adding a second module:** once a second bounded context exists (e.g. a future `modules/investments/`), modules call each other only through their `index.ts` facade — never import another module's service/repository/entity directly, same rule as the aggregate boundary above, one level up.
- **Scope of "modular":** adopted modules folder structure, aggregate-per-entity, facade + restricted `index.ts` exports, and co-located tests; deliberately not adopted: per-module DB connections, a DI container, or `<module>.module.ts` (that file exists in temp.md's NestJS source only to register providers with a DI container — Capital Care has none, so `index.ts` does that wiring directly instead) — multiple modules/subdomain splitting only make sense once there's more than one bounded context.
- **Composition/wiring: manual factory functions, no DI container.** Dependencies are passed explicitly (`createUserService(createUserRepository(db))`), wired once in `modules/ledger/index.ts`. Chosen specifically for AI-assisted development: everything is visible in plain TypeScript with no decorators/reflection/runtime container magic, so an agent (and the compiler) can trace and verify dependencies directly from the code — consistent with the low-ceremony rationale behind picking Express over NestJS (see [api.md](./api.md)).

## DB Types vs Domain Types

- **Row/schema types (Drizzle-inferred) never leak past the repository layer.** They may be similar to the application's domain/business types, but they are not the same type — a DB column is a storage detail, a domain type is a business concept.
- Repositories accept/return **domain types**; the mapping between a Drizzle row and a domain type happens inside the repository (or a dedicated mapper), not at the call site. This includes enum mapping and money mapping.
- **Money specifically:** the repository maps the stored decimal-string column to a domain `Decimal` type (e.g. `decimal.js`). All arithmetic (sums, balances) happens in the app layer using that `Decimal` type — never native floating-point math. The storage rationale (why `TEXT`, not native `NUMERIC`) is documented in [database.md](./database.md).
- This keeps a future SQLite → PostgreSQL dialect switch contained to the repository/entity layer — services, controllers, and validation (Zod) never need to change.

## Environment Configuration

- All configuration (DB file path/connection string, future JWT secret, etc.) comes from a `.env` file — never hardcoded. Commit a `.env.example` template; the actual `.env` stays gitignored.

## Tooling

- **Linting & Formatting:** ESLint + Prettier.
