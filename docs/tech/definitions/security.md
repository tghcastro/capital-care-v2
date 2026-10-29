# Security

## Authentication

- **JWT** planned as the long-term mechanism, but **not implemented initially**.
- **Interim approach:** until JWT is wired up, the "current user" is identified via a request header (e.g. `X-User-Id`) instead of real auth. Isolate this behind a single piece of middleware that resolves "current user id" for the request — services/routes should depend on that resolved value, not read the header directly. When JWT is implemented, only that middleware changes (header lookup → verified token claim); services, routes, and authorization checks stay untouched.
- This middleware lives in the shared `middleware/` folder (see [architecture.md](./architecture.md#api-layering--composition)) — it is cross-cutting and intentionally not owned by any single aggregate.
- **No acting user → `401`.** If a request carries no acting-user identity (missing header today; missing, invalid or expired token once JWT exists), the middleware rejects it with an unauthenticated error (`401`, e.g. `UnauthenticatedError` in the shared error hierarchy per [api.md](./api.md#error-handling)). Exempt routes: `POST /users` (registration) and `GET /health`.
- **Unknown or deleted acting user → `404`.** The middleware only resolves the id; whether that user exists and is active is checked by the services (through the User service, never its repository), which throw `NotFoundError` (`404`). "Never existed" and "deleted" get the identical response, so it doesn't reveal whether a user ever existed. The check lives in services rather than the middleware so documented exceptions (e.g. repeating a deletion of one's own profile) stay possible.
- The interim header is **not** a security barrier — any caller can send any id. The uniform `404` limits what probing reveals, but real protection arrives with JWT.
- Entities tied to a user (Account, Transaction, etc.) still carry their normal owner/user reference column — that's a data-modeling requirement independent of how the current user is identified, not something deferred.

## Security Headers

- `helmet()` as global middleware, using its defaults (disables `X-Powered-By`, sets `X-Content-Type-Options`, `Strict-Transport-Security`, etc.). Independent of the CORS/rate-limiting/auth status below — zero-config, applied from day one.

## CORS

- Deferred — not needed until a browser-based client (the future Web app) exists. Only applies to the API once there is a `apps/web` origin to allow.

## Rate Limiting

- Not needed for now.
