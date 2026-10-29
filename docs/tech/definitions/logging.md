# Logging

- **Pino** — fast, structured JSON logging, the most common choice for modern Node APIs.
- Request-scoped context (e.g. `requestId`, current user id) is attached to every log line via Node's built-in `AsyncLocalStorage`, the standard Node substitute for Log4j-style MDC (Node has no threads, so there's no thread-local context — `AsyncLocalStorage` is the async-scoped equivalent).
- This context setup lives in the shared `middleware/` folder (see [architecture.md](./architecture.md#api-layering--composition)), same as the current-user resolver — cross-cutting, not owned by any single aggregate.
