# ADR-002: Identity as a Separate Module

- **Date**: 2026-11-23
- **Status**: Accepted (not yet implemented; delivered by [CAP-5](https://linear.app/tghcastro/issue/CAP-5/base-authentication))
- **Deciders**: tghcastro (owner), with the Claude Code agent that wrote the Base Authentication plan
- **Tags**: architecture, modules, security
- **Origin**: decision AD-008 in [`.specs/STATE.md`](../../.specs/STATE.md)

## Context and Problem Statement

Base authentication adds users with credentials, sessions and sign-in. Until now the only `user` table sat in `modules/ledger`, empty, with ledger tables owning rows through a `userId` text column. The next three PRDs (user management, password recovery, rate limiting) change identity and not the ledger. Where should identity live?

## Decision Drivers

- Identity has its own language (credentials, sessions, tokens) that has nothing to do with accounting.
- Upcoming work should change identity without touching the ledger.
- Moving a populated table between two migration sets later is expensive; the table is empty today.
- Keep operations simple: one SQLite file, one deploy.

## Considered Options

- **A.** New module `modules/identity` beside `modules/ledger`: same SQLite file, its own migrations folder and migrations table, exports only through `index.ts`. The ledger keeps `userId` as text and never imports identity; `apps/api` composes both.
- **B.** Keep `user` in `modules/ledger` and add sessions there.
- **C.** A separate module with its own database file.

## Decision Outcome

Chosen option: **A**, because it gives identity a clear boundary while the table is still empty, at no operational cost. It was recommended in the plan conversation and approved by the owner.

### Positive Consequences

- Identity and ledger evolve independently; a module-boundary rule (no imports between them) is checkable.
- Later, when one module must act on the other's data, it does so through a callback wired in `apps/api` (AD-011), not a direct import.

### Negative Consequences

- No foreign key from ledger rows to `user`. Deleting a user's data needs explicit composition code.
- Two migration sets in one database file must be run together and stay in sync with the build, Dockerfile and test config.

## Pros and Cons of the Options

### A. Separate module, same database ✅ Chosen

- ✅ Clear boundary, cheap now
- ✅ One file, shared transactions still possible
- ❌ No cross-module foreign keys

### B. Identity inside the ledger

- ✅ No new package
- ❌ Mixes two languages; future PRDs touch the ledger
- ❌ Extracting later means moving a populated table

### C. Separate module and database file

- ✅ Strongest isolation
- ❌ Two connections and no shared transaction, for no gain today

## Links

- Plan: [`.specs/features/base-authentication/plan.md`](../../.specs/features/base-authentication/plan.md), one-way door 8
- Related: [ADR-003](003-jwt-access-token-with-rotating-refresh-cookie.md)
