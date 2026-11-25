# ADR-003: JWT Access Token with a Rotating Refresh Cookie

- **Date**: 2026-11-23
- **Status**: Accepted (not yet implemented; delivered by [CAP-5](https://linear.app/tghcastro/issue/CAP-5/base-authentication))
- **Deciders**: tghcastro (owner), with the Claude Code agent that wrote the Base Authentication plan
- **Tags**: security, authentication
- **Origin**: decision AD-009 in [`.specs/STATE.md`](../../.specs/STATE.md)

## Context and Problem Statement

Today the acting user is whatever id the caller sends in the `X-User-Id` header, so anyone who can reach the app can read or change any user's data. Capital Care needs a real, verified identity, built in-house with no external identity provider. The project is also a learning vehicle, so understanding the mechanism matters as much as using it.

## Decision Drivers

- Verified identity on every data request.
- Sessions that survive a page reload but can be ended on sign-out and password change.
- Resistance to token theft through XSS and CSRF.
- Learning value: the owner explicitly wanted to work with JWTs.

## Considered Options

- **A.** Short-lived `HS256` access JWT (`sub` = user id) sent as `Authorization: Bearer`, kept in browser memory only; session in an `HttpOnly; SameSite=Strict; Path=/auth` refresh cookie `cc_refresh` that rotates on every refresh, backed by a `user_session` table.
- **B.** The same tokens, but the server checks the session table on every request.
- **C.** Opaque server-side session id in a cookie, no JWT.

## Decision Outcome

Chosen option: **A**. The owner chose a pure JWT for the access token (*"JWT kept for learning"*), and, asked how revocation should behave, chose *"Accept up to the access token lifetime"*. `X-User-Id` is removed.

### Positive Consequences

- Data requests are verified without a database lookup.
- The access token is never persisted (no `localStorage`), and it expires quickly; the refresh cookie is not readable by JavaScript and is only sent to `/auth`.
- Rotation means a stolen refresh token stops working after the next legitimate refresh.

### Negative Consequences

- Revoking a session (sign-out elsewhere, password change, account deletion) takes effect on other devices only when their access token expires (15 minutes by default).
- The web client needs a silent refresh and one retry after a `401`.
- A secret (`AUTH_JWT_SECRET`, 32+ characters) must be managed; the app refuses to start without it.

## Pros and Cons of the Options

### A. Pure JWT + rotating refresh cookie ✅ Chosen

- ✅ Stateless checks, strong cookie settings, learning value
- ❌ Revocation delayed up to the access token lifetime

### B. JWT checked against sessions on every request

- ✅ Immediate revocation
- ❌ A database read per request removes the main benefit of the JWT

### C. Opaque session cookie

- ✅ Simplest, immediate revocation
- ❌ Misses the learning goal; CSRF protection needed on every route

## Links

- PRD: [`.prd/base-authentication.md`](../../.prd/base-authentication.md)
- Plan: [`.specs/features/base-authentication/plan.md`](../../.specs/features/base-authentication/plan.md), one-way door 4
- Related: [ADR-002](002-identity-as-a-separate-module.md), [`docs/tech/definitions/security.md`](../tech/definitions/security.md)
