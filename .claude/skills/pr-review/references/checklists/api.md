# Checklist: API

Source: [`docs/tech/definitions/api.md`](../../../../../docs/tech/definitions/api.md).

1. **Routes.** Flat plural nouns, scoped to the acting user, no path nesting under `/users/:id`, no `/v1`. Route paths defined in `apps/api/src/app.ts` instead of the aggregate's controller. → `#routes`.
2. **Pagination.** `pageSize` default 99, max 999, invalid values rejected (never clamped). → `#routes`.
3. **Validation.** Zod schemas hand-written for the API (not `drizzle-zod` output); no `.strict()` or `.passthrough()`; services receive only the parsed result, never `req.body`. → `#validation`.
4. **Errors.** Errors thrown as the shared error classes and serialized only by the error middleware (RFC 7807 shape with `details`); controllers or services building error JSON; a `403` or `ForbiddenError` for another user's resource (must be `404`). → `#error-handling`.
5. **Documentation.** A new or changed route or contract without the matching Bruno request(s) in `tools/bruno/capital-care` (success path and new error statuses, self-cleaning, unique names). → `#documentation`.
6. **Request handling.** Body limit changed from `100kb`; `/health` contract changed. → `#request-handling`.
