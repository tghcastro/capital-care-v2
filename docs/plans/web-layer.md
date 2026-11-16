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

## Phase 2 — Shared package

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

## Phase 4 — Build, serve, CI

1. Dockerfile: build the web assets and serve them from the same origin as the API (Express static + SPA fallback, or a small static server in front). Decide when implementing; record in `web.md`.
2. CI: web build + web tests in the `test` job; update `ci-cd.md` in the same PR.

## Done when

- Phase 1: definitions updated, cross-links resolve, no contradiction left between `web.md`, `architecture.md`, `security.md`, `testing.md`.
- Phases 2–4: `pnpm test` runs both node and web projects green in CI; the image serves the SPA and API on one port; this plan is deleted and its decisions live in `docs/tech/definitions/`.
