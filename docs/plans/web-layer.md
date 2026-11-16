# Plan: Web layer (apps/web) — stack, tests, and documentation

Status: **Phase 1 (documentation) in progress. Phases 2–4 not started.**

## Goal

Add a browser client, `apps/web`, that talks to `apps/api` over HTTP only. Decide its libraries and its non-E2E test approach, record them in `docs/tech/definitions/`, then scaffold the app.

## Decisions already made (do not re-litigate)

| Concern              | Decision                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build tool           | **Vite**                                                                                                                                                                               |
| UI framework         | **React** + TypeScript (strict, same flags as the rest of the repo)                                                                                                                    |
| App shape            | **Single-page app (SPA)**. No Next.js or other SSR framework: Express already serves the API, and the app boundary rule forbids the web app from importing modules or touching the DB. |
| Server state         | **TanStack Query**. No global client-state store until a real need appears.                                                                                                            |
| Routing              | **React Router**                                                                                                                                                                       |
| Forms + validation   | **React Hook Form** + **`@hookform/resolvers/zod`**, reusing the Zod request schemas from `packages/shared`                                                                            |
| API client           | A typed `fetch` wrapper in **`packages/shared`**. It is the only place that sets the acting-user header (`X-User-Id` today, a JWT later).                                              |
| Money                | **`decimal.js`** for arithmetic; `Intl.NumberFormat` for display. Never native floating-point math.                                                                                    |
| Dates                | **date-fns**                                                                                                                                                                           |
| Styling / components | **Tailwind CSS** + **shadcn/ui** (component source copied into `apps/web`)                                                                                                             |
| Lint                 | Existing flat config + **`eslint-plugin-react-hooks`** + **`eslint-plugin-jsx-a11y`** for `apps/web`                                                                                   |
| Module resolution    | `apps/web` uses `"module": "ESNext"` + `"moduleResolution": "Bundler"` (documented exception to the NodeNext rule; no `.js` extensions in its imports).                                |
| CORS                 | Avoided by serving web and API from **one origin**: Vite dev-server proxy in DEV; built static files served from the same origin in PRD. CORS stays not needed.                        |

### Front-end tests (non-E2E)

| Piece                  | Decision                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Runner                 | **Vitest**, as a separate `web` project under `test.projects` in the root `vitest.config.ts`           |
| DOM environment        | **jsdom**                                                                                              |
| Rendering + assertions | **@testing-library/react** + **@testing-library/jest-dom**                                             |
| Interactions           | **@testing-library/user-event**                                                                        |
| HTTP mocking           | **MSW (Mock Service Worker)**: mock at the network boundary, never `fetch` or TanStack Query internals |

Test levels for `apps/web`:

- **Unit:** pure functions with no DOM (money formatting, month ranges, API-data → view-model mapping). Plain Vitest.
- **Component:** a component or screen rendered with Testing Library, API answered by MSW.
- **E2E:** already defined in `testing.md` (one structure per client); its tool is not part of this plan.
- **Contract:** stays deferred. Sharing Zod schemas via `packages/shared` covers type drift for now.

Vitest Browser Mode is a possible later switch if jsdom gaps hurt; not adopted now.

## Phase 1 — Documentation (this PR)

Docs only, no code. Follow `docs/tech/AGENTS.md` conventions: definitions are living documents, record only what is decided.

1. **Create `docs/tech/definitions/web.md`** with the stack table above, the app boundary reminder, API client and current-user header rule, money/date rules, styling, lint additions, module-resolution exception, same-origin serving, and folder layout of `apps/web`.
2. **Update `docs/tech/definitions/architecture.md`**
   - Repository structure: `apps/web` is no longer "future"; describe it as the React SPA, link `web.md`.
   - Language & runtime → ES modules: add the `apps/web` Bundler exception (link `web.md`).
   - `packages/shared`: state that request/response Zod schemas and the typed API client used by `apps/web` live here.
   - Tooling: mention the React ESLint plugins for `apps/web`.
3. **Update `docs/tech/definitions/security.md`**
   - CORS: replace "deferred until the web app exists" with "not needed: web and API share one origin (see `web.md`)"; revisit only if they are ever served from different origins.
   - Authentication: the web client sets the acting-user header only in the shared API client.
4. **Update `docs/tech/definitions/testing.md`**
   - Add a web section: tools (Vitest `web` project, jsdom, Testing Library, user-event, MSW), the Unit / Component levels for `apps/web`, and test location (co-located `__test__/` folders inside `apps/web/src`, mirroring the backend convention).
   - Contract: update the wording, since `apps/web` is now introduced; keep it deferred with the reason above.
5. **Update `docs/tech/AGENTS.md`**: add `web.md` to the file list and a "Implementing a web feature" line in "What to Read".
6. **Update `docs/plans/AGENTS.md`**: list this plan.

Not in phase 1: `ci-cd.md` describes the pipeline that actually runs. It changes in phase 4 together with the workflow.

## Phase 2 — API prefix and shared package

0. Mount the API routes under `/api` (see [Prerequisite: API routes under `/api`](#prerequisite-api-routes-under-api) in phase 4).
1. Move (or re-export) the ledger request/response Zod schemas from `modules/ledger/src/*/…dto.ts` into `packages/shared`, keeping the ledger module importing them from there.
2. Add the typed `fetch` API client to `packages/shared` (base URL, acting-user header, error body → typed error).
3. Unit tests for the client (MSW in node).

## Phase 3 — Scaffold `apps/web`

1. Add `apps/web` to `pnpm-workspace.yaml` and the root `workspaces`.
2. Vite + React + TS config (Bundler resolution), Tailwind, shadcn/ui init, React Router, TanStack Query provider.
3. Vite dev proxy `/api` → `http://localhost:3000`.
4. Add the `web` Vitest project (jsdom, setup file with jest-dom and MSW server); keep the existing node project unchanged.
5. ESLint: React plugins scoped to `apps/web/**`.
6. One sample screen (e.g. accounts list) with a component test, to prove the setup end to end.

## Phase 4 — Docker image, deployment, CI

### Decision: one image (proposed default — owner confirms before phase 4)

The web app ships **inside the existing API image**. Express serves the built SPA as static files, on the same port as the API. No second image, no nginx.

| Option                                                                       | Pros                                                                                                                                                                                                                                                                              | Cons                                                                                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. One image (Express serves the SPA)** — chosen                           | One image to build, scan, smoke-test, tag and publish; current CI and Compose stay almost as they are. One origin, so CORS is not needed. Web and API share Zod schemas, so they must ship together anyway: one image and one version tag remove any risk of mismatched versions. | Web and API are released together (not a problem here). Express is a less tuned static server than nginx (fine for a single-user tracker).                   |
| B. Two images (nginx serves the SPA and proxies `/api` to the API container) | Independent releases and scaling; nginx caching/compression.                                                                                                                                                                                                                      | Two images in CI (build, audit, smoke test, publish, tags), an nginx config to own, a second Compose service, and possible version skew between web and API. |

Revisit B only if the web app needs a CDN, independent releases, or a different host from the API.

### Prerequisite: API routes under `/api`

Today the routers are mounted at the root (`/accounts`, `/categories`, `/transactions`). SPA routes such as `/accounts` would collide with them. Fix it in **phase 2**, before the web app exists:

1. Mount the ledger routers under `/api` (`/api/accounts`, …). Keep `GET /health` at the root (Docker `HEALTHCHECK` and CI smoke test use it).
2. Update the component tests in `apps/api/test/`, the Bruno environments (`baseUrl` gets `/api`), and `docs/tech/definitions/api.md` (route conventions).
3. The Vite dev proxy then forwards `/api` to `http://localhost:3000` without rewriting.

### Dockerfile changes

1. `deps` stage: also copy `apps/web/package.json` so the web dependencies install from the lockfile.
2. `build` stage: run the web build (`pnpm --filter @capital-care/web build`) next to `pnpm build`, producing `apps/web/dist`.
3. `runtime` stage: copy only the built static files (`apps/web/dist` → `/app/public`). No web `node_modules` in the runtime image; it stays slim.
4. `apps/api`: serve `/app/public` with `express.static`, and add an SPA fallback that returns `index.html` for `GET` requests outside `/api` and `/health`. The static directory comes from an env var (e.g. `WEB_DIST_PATH`, documented in `.env.example`); when unset (local API development), the API serves no static files.
5. Cache headers: hashed assets under `/assets` get long-lived caching; `index.html` gets `no-cache`.
6. `helmet` (planned in `security.md`): its default Content Security Policy must allow the Vite build output (no inline scripts); verify when both are in place.

### Local development and Compose

- **DEV (day to day):** API in Docker or locally on port 3000, plus `pnpm --filter @capital-care/web dev` (Vite on port 5173, proxying `/api`). No web container: hot reload needs the Vite dev server.
- **Compose:** no new service. `docker-compose.dev.yml` and `docker-compose.prd.yml` keep the single `api` service; the same container now also serves the web app on the same host port (DEV `3000`, PRD `8000`). Update the Compose header comments to say so.

### CI (`ci-cd.md` updated in the same PR)

1. `test` job: web type-check, lint, web Vitest project, and web build (already covered if `pnpm build`/`pnpm test` include `apps/web`).
2. `build` job: keep the `GET /health` smoke test and add one check that `GET /` returns `index.html` (status `200`, `text/html`).
3. `publish`: unchanged; the same single image and tags.

### Documentation to update in phase 4

- `web.md` → "Same-Origin Serving": replace "mechanism recorded when implemented" with the one-image decision and the `/api` prefix.
- `architecture.md` → Environment Configuration: the new static-path env var.
- `ci-cd.md`: the extra smoke check.

## Done when

- Phase 1: definitions updated, cross-links resolve, no contradiction left between `web.md`, `architecture.md`, `security.md`, `testing.md`.
- Phases 2–4: `pnpm test` runs both node and web projects green in CI; the image serves the SPA and API on one port; this plan is deleted and its decisions live in `docs/tech/definitions/`.
