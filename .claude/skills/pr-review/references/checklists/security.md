# Checklist: security

Sources: [`docs/tech/definitions/security.md`](../../../../../docs/tech/definitions/security.md), [`logging.md`](../../../../../docs/tech/definitions/logging.md). ADR: [003](../../../../../docs/adr/003-jwt-access-token-with-rotating-refresh-cookie.md) (accepted, not yet implemented).

1. **Acting user.** Code reading `X-User-Id` (or a token) directly instead of the resolved current-user value from the middleware. → security.md `#authentication`.
2. **401 vs 404.** A new route that skips the auth middleware (only `POST /users` and `GET /health` are exempt); an unknown or deleted user that does not get `404`. → `#authentication`.
3. **Ownership.** A query on a user-owned entity that does not filter by the acting user; another user's resource returning anything but `404`. → api.md `#error-handling`.
4. **Headers.** `helmet()` removed or weakened. → `#security-headers`.
5. **Injection.** Raw SQL built with string concatenation or template literals around user input (Drizzle's `sql` tag with placeholders is fine); shell commands built from input.
6. **Secrets.** Keys, tokens or passwords in code, tests, fixtures, logs or `VITE_*` variables.
7. **Logging.** Credentials, tokens, full request bodies or financial details logged; PII beyond what the business rules allow. → logging.md.
8. **Dependencies.** A new runtime dependency with install scripts, or added to the build-script allowlist (`allowBuilds`, `.pnpmfile.cjs`). → web.md `#dependency-and-front-end-security`.
