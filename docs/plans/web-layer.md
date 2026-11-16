# Plan: Web layer (apps/web) — stack, tests, and a "Hello world" site

Status: **Phase 1 (documentation) done in this PR. Phases 2–3 not started.**

## Goal

Record the web stack and its non-E2E test approach in `docs/tech/definitions/`, then ship a **"Hello world" site**: `apps/web` with one temporary page that calls only `GET /health` and shows whether the API is up. It is built into the existing Docker image and served on the same origin as the API.

## Out of scope

- **Any other API integration**: ledger endpoints, the typed API client and Zod schemas in `packages/shared`, the acting-user header. Done in a separate request and branch.
- **Real design and page structure**: the temporary page uses plain Tailwind utility classes, no shadcn/ui components, no layout system. The real design comes in another PR.
- **Changes to API routes** (e.g. an `/api` prefix): needed once SPA routes could collide with API routes, so it belongs to the API-integration work. This plan only adds static file serving to `apps/api`.
- Libraries the page does not use yet (React Router, React Hook Form, `decimal.js`, date-fns, shadcn/ui): they stay decided in `web.md` and are installed by the first feature that needs them.

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

1. **Create `docs/tech/definitions/web.md`** with the stack table above, the app boundary reminder, API client and current-user header rule, money/date rules, styling, lint additions, module-resolution exception, same-origin serving, folder layout of `apps/web`, and dependency and front-end security rules.
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

Not in phase 1: `ci-cd.md` describes the pipeline that actually runs. It changes in phase 3 together with the workflow.

## Phase 2 — Scaffold `apps/web` with the health page

1. Add `apps/web` (`@capital-care/web`) to `pnpm-workspace.yaml` and the root `workspaces`.
2. Add `minimumReleaseAge: 4320` to `pnpm-workspace.yaml` before installing the web dependencies, and keep the build-script allowlist unchanged (see `web.md` → Dependency and Front-End Security).
3. Vite + React + TypeScript (strict flags, Bundler resolution), Tailwind CSS, and a TanStack Query provider. Nothing else from the stack table.
4. **Health page** (the only page, at `/`): title "Capital Care", and an API status line driven by a TanStack Query call to `GET /health`:
   - loading → "Checking API…"
   - `200` with `{"status":"ok"}` → "API is up"
   - error or any other response → "API is unreachable"
   - Plain `fetch` inside the page's query function. No shared API client yet.
5. Vite dev server proxies `/health` to `http://localhost:3000`.
6. ESLint: `eslint-plugin-react-hooks` + `eslint-plugin-jsx-a11y`, scoped to `apps/web/**`.
7. Tests: add the `web` Vitest project (jsdom, setup file with jest-dom and an MSW server); keep the existing node project unchanged. One component test file for the health page covering the three states above, with MSW answering `/health`.
8. Root scripts: `pnpm build`, `pnpm test`, `pnpm lint` and `pnpm type-check` include `apps/web`.

## Phase 3 — Docker image, deployment, CI

### Decision: one image (proposed default — owner confirms before phase 3)

The web app ships **inside the existing API image**. Express serves the built SPA as static files, on the same port as the API. No second image, no nginx.

| Option                                                                       | Pros                                                                                                                                                                                                                                                                              | Cons                                                                                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. One image (Express serves the SPA)** — chosen                           | One image to build, scan, smoke-test, tag and publish; current CI and Compose stay almost as they are. One origin, so CORS is not needed. Web and API share Zod schemas, so they must ship together anyway: one image and one version tag remove any risk of mismatched versions. | Web and API are released together (not a problem here). Express is a less tuned static server than nginx (fine for a single-user tracker).                   |
| B. Two images (nginx serves the SPA and proxies `/api` to the API container) | Independent releases and scaling; nginx caching/compression.                                                                                                                                                                                                                      | Two images in CI (build, audit, smoke test, publish, tags), an nginx config to own, a second Compose service, and possible version skew between web and API. |

Revisit B only if the web app needs a CDN, independent releases, or a different host from the API.

### Dockerfile and API changes

1. `deps` stage: also copy `apps/web/package.json` so the web dependencies install from the lockfile.
2. `build` stage: run the web build next to `pnpm build`, producing `apps/web/dist`.
3. `runtime` stage: copy only the built static files (`apps/web/dist` → `/app/public`). No web `node_modules` in the runtime image; it stays slim.
4. `apps/api/src/app.ts`: serve the static directory with `express.static`, registered after the API routers so it never shadows them. The directory comes from an env var (e.g. `WEB_DIST_PATH`, set in the Dockerfile and documented in `.env.example`); when unset (local API development), no static files are served. No SPA fallback yet: there is only one page at `/`; the fallback comes with client-side routing.
5. Cache headers: hashed assets under `/assets` get long-lived caching; `index.html` gets `no-cache`.

### Local development and Compose

- **DEV (day to day):** API in Docker or locally on port 3000, plus `pnpm --filter @capital-care/web dev` (Vite, proxying `/health`). No web container: hot reload needs the Vite dev server.
- **Compose:** no new service. The single `api` service now also serves the web app on the same host port (DEV `3000`, PRD `8000`). Update the Compose header comments to say so.

### CI (`ci-cd.md` updated in the same PR)

1. `test` job: covered once the root scripts include `apps/web` (type-check, build, web Vitest project).
2. `build` job: keep the `GET /health` smoke test and add one check that `GET /` returns the HTML page (status `200`, `text/html`).
3. `publish`: unchanged; the same single image and tags.

### Documentation to update in phase 3

- `web.md` → "Same-Origin Serving": replace "mechanism recorded when implemented" with the one-image decision.
- `architecture.md` → Environment Configuration: the static-path env var.
- `ci-cd.md`: the extra smoke check.

## Done when

- Phase 1: definitions updated, cross-links resolve, no contradiction left between `web.md`, `architecture.md`, `security.md`, `testing.md`.
- Phases 2–3:
  - `pnpm test` runs the node and web projects green in CI.
  - Running the image and opening `http://localhost:3000/` (DEV) shows the page with "API is up".
  - Stopping the API in local Vite development shows "API is unreachable".
  - No ledger endpoint is called from `apps/web`.
