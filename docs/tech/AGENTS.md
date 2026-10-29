# AGENTS.md — docs/tech

Scope: this file applies only to `docs/tech/` and its subfolders. See the [root AGENTS.md](../../AGENTS.md) for project-wide context.

**CRITICAL - Progressive Disclosure**: DO NOT read documents that are not relevant for your current task. 

## What's Here

Stack-level technical decisions for Capital Care — the "how," decided once and shared across the whole project. This folder contains **no business rules or acceptance criteria**.

Decisions live in [docs/tech/definitions/](./definitions/), one file per topic:

- [definitions/architecture.md](./definitions/architecture.md) — language/runtime, repo structure, package manager, API layering & composition, DB ↔ domain type boundary, environment config, lint/format tooling.
- [definitions/database.md](./definitions/database.md) — DB engine/driver, schema conventions (money, enums, deletion, timestamps, IDs, dates), constraints, transactions.
- [definitions/api.md](./definitions/api.md) — API framework, route conventions, validation, error handling, documentation, request handling.
- [definitions/security.md](./definitions/security.md) — authentication, security headers, CORS/rate-limiting status.
- [definitions/logging.md](./definitions/logging.md) — logging library and request-context convention.
- [definitions/testing.md](./definitions/testing.md) — test runner, test database strategy.
- [definitions/git.md](./definitions/git.md) — branching and merge strategy, branch names, commit message pattern, pull request template.

## What to Read, Depending on the Task

Don't read every file for every task — pick only the ones relevant to what you're building:

- **Implementing an API endpoint:** `architecture.md`, `database.md`, `api.md`. Add `security.md` only if the task touches auth/current-user resolution; add `logging.md` only if adding/changing log statements.
- **Writing/running tests:** `testing.md`, plus whichever of the above covers the thing under test.
- **Creating a branch, commit, or PR:** `git.md` only.
- **When in doubt about scope:** read the one file whose name matches the topic you're changing; cross-references between files (e.g. `database.md` linking to `architecture.md#db-types-vs-domain-types`) tell you when a second file is actually relevant, so you don't need to read all of them defensively.

## Conventions

- Each file is **living** — edit in place as decisions are made or revised (unlike an ADR, which is an immutable record of *why* a decision was made at a point in time). This applies equally to `definitions/*.md`.
- A topic is only documented once it is actually decided; undecided topics are not speculated on.
