# Testing

## Test Runner

- **Vitest** for unit and integration tests.

## Test Levels (Test Pyramid)

Four levels, adapted from [Fowler's microservice testing taxonomy](https://martinfowler.com/articles/microservice-testing/) to Capital Care's current structure ([architecture.md](./architecture.md#api-layering--composition)). The decision rule for classifying a scenario is **which boundary the test enters at**:

- **Unit** — enters at a single aggregate's `*.service.ts` (business rules/branches: each `if`/`else` condition). No real DB; dependencies (its own repository, other aggregates' services) are mocked. Target near-100% coverage on the service layer specifically — not repository/controller glue.
  - Also covers **pure, dependency-free modules** such as an aggregate's validation schemas (e.g. its Zod request schemas): field rules, boundaries and format permutations are proven here by calling the module directly. The HTTP wiring of those rules (status code, error body) is then proven once per error type at Component level, not per field.
- **Integration** — enters at an aggregate's own entrypoint (`*.controller.ts`/`*.service.ts`) and runs through its internal structure (repository, entity) against a real, disposable DB instance (see Test Database Strategy below). Mocks only *other aggregates'* services (per the aggregate boundary rule in [architecture.md](./architecture.md#api-layering--composition)) and true external clients (e.g. a payment provider) — never its own internal classes.
- **Component** — enters at the whole `apps/api` process (or whichever deployable API, if more than one exists later). Runs against a real disposable DB instance (see Test Database Strategy below) — a fully disposable environment per run. External HTTP dependencies (e.g. a future payment provider) are stubbed with **WireMock**. A message broker is not decided yet — if one is introduced later, it joins this disposable environment the same way, but naming a specific tool here would be speculating ahead of that decision (see [docs/tech/AGENTS.md](../AGENTS.md) on not pre-deciding undecided stack).
- **End-to-End (E2E)** — enters from a real client's perspective (future `apps/web`, mobile apps, etc.), exercising a full user journey against the real API and a disposable environment, same as Component. One test structure per client app, since each client may differ. (Equivalent to classic "System testing"/acceptance testing — "End-to-End" is the more common modern/industry term and is used here instead.)
- **Contract** — not yet applicable: no second independently-deployable client or external integration exists yet. Revisit (e.g. Pact-style consumer-driven contracts) once `apps/web` or an external integration is introduced, same as the Web stack being deferred in [architecture.md](./architecture.md).

## Test Location

- Unit tests are co-located inside each aggregate's `__test__/` folder (e.g. `modules/ledger/account/__test__/account.service.spec.ts`), next to the code they test — matching the module/aggregate layout in [architecture.md](./architecture.md#api-layering--composition).
- Integration tests that cross into an aggregate's internal structure (repository/entity) or hit the DB also live under that aggregate's `__test__/` folder, since they still test a single aggregate's entrypoint.
- Component and End-to-End tests, which cross aggregate boundaries or exercise the whole API process, live in a top-level `apps/api/test/` folder, outside any single module.

## Test Database Strategy

- Tests run against an isolated DB instance per run (not the dev DB file), reset between runs, using whichever engine/driver is current per [database.md](./database.md#engine--driver) (SQLite today; the same strategy carries over if/when that migrates to PostgreSQL).
