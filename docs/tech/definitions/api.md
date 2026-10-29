# API

## Framework

- **Express**
- Rationale: simplest learning curve of the options considered (Fastify, NestJS) — minimal concepts, most tutorials/examples, lowest ceremony for a solo learning project. Can be revisited later if performance or built-in schema validation becomes a priority.

## Routes

- **REST**, flat plural-noun resources (`/accounts`, `/categories`, `/transactions`, `/users/:id`), scoped implicitly to the current user (via the interim `X-User-Id` header, later the JWT claim — see [security.md](./security.md)) rather than path-nested under `/users/:id/...`.
- Standard HTTP verbs; `DELETE` maps to the soft-delete ("deactivate"/logical delete) operation, never a physical removal.
- Filtering/pagination/sorting via query params (e.g. `?accountId=&categoryId=&page=&pageSize=&sort=-date`), not separate endpoints.
- No API versioning for now (e.g. no `/v1` prefix) — revisit if/when a breaking change is needed.
- **Router ownership:** each aggregate's `<aggregate>.controller.ts` owns and returns its Express router (e.g. `account.controller.ts` owns `/accounts` — there is no separate route file, see [architecture.md](./architecture.md#api-layering--composition)); `modules/ledger/index.ts` exports the routers, and `apps/api/src/app.ts` only mounts them, never defining route paths itself:
  ```ts
  // apps/api/src/app.ts
  app.use('/accounts', accountRouter);
  app.use('/transactions', transactionRouter);
  ```

## Validation

- **Zod** — domain/API-level schemas are hand-defined from the business rules, not derived from the DB schema (`drizzle-zod`): request/response validation belongs to the domain layer, DB schema is a storage detail (see [architecture.md](./architecture.md#db-types-vs-domain-types)). `drizzle-zod` may still be used internally within the repository layer to validate data at the DB boundary, but its output must not be reused as API input/output validation.
- **Unknown request fields are silently ignored.** Request schemas strip any field they don't define (Zod's default object behavior — never `.strict()` or `.passthrough()`), and only the parsed result is passed to services. A client can therefore never set a field the schema doesn't expose (e.g. `id`, `createdAt`, an owner id).

## Error Handling

- **Response/error shape:** [RFC 7807 "Problem Details for HTTP APIs"](https://www.rfc-editor.org/rfc/rfc7807) — `type`, `title`, `status`, `detail`, `instance`, extended with a `details` array for field-level validation errors (maps naturally onto Zod's error output).
- **Convention:** a small hierarchy of custom error classes (e.g. `NotFoundError`, `ConflictError`, `ValidationError`), each carrying its intended HTTP status, thrown from services. They live in the module's `shared/errors.ts` (e.g. `modules/ledger/shared/errors.ts`, see [architecture.md](./architecture.md#api-layering--composition)), not per-aggregate, since the error hierarchy itself is reused by every aggregate in the module. One centralized Express error-handling middleware (last in the chain) catches them and serializes the Problem Details response — controllers/services never format error JSON themselves.
- **Another user's resource → `404`.** Ownership/authorization failures throw `NotFoundError` (`404`), never a `403`: a resource the acting user may not touch gets exactly the same response as one that doesn't exist, so the API never reveals whether another user's data exists. There is no `ForbiddenError` class. (Same principle as the unknown/deleted acting user rule in [security.md](./security.md#authentication).)

## Documentation

- **OpenAPI**, generated from the same Zod schemas already used for request/response validation (e.g. via `zod-to-openapi`) — one source of truth instead of hand-maintained docs drifting from the real validation.

## Request Handling

- **Request body size limit:** `express.json({ limit: '100kb' })` — payloads here are small JSON only (no file uploads), so this stays generous while blocking abusive oversized bodies.
- **Health check:** `GET /health` convention, returning a minimal liveness response.
