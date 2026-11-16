# Web

`apps/web` is the browser client for Capital Care. It talks to `apps/api` over HTTP only.

## Stack

- **Build tool:** Vite.
- **UI framework:** React + TypeScript, with the same strict flags as the rest of the repo (see [architecture.md](./architecture.md#language--runtime)).
- **App shape:** single-page app (SPA). No Next.js or other SSR framework: Express already serves the API, and the app boundary rule forbids the web app from importing modules or touching the DB.
- **Server state:** TanStack Query. No global client-state store until a real need appears.
- **Routing:** React Router.
- **Forms + validation:** React Hook Form + `@hookform/resolvers/zod`, reusing the Zod request schemas from `packages/shared`.
- **API client:** a typed `fetch` wrapper in `packages/shared` (see API Client below).
- **Money:** `decimal.js` for arithmetic, `Intl.NumberFormat` for display. Never native floating-point math (same rule as [architecture.md](./architecture.md#db-types-vs-domain-types)).
- **Dates:** date-fns.
- **Styling / components:** Tailwind CSS + shadcn/ui (component source is copied into `apps/web`, not installed as a dependency).

## App Boundary

- `apps/web` only talks to `apps/api` over HTTP. It never imports from `modules/ledger` or touches the DB (see [architecture.md](./architecture.md#repository-structure)).
- Code shared with the API (Zod schemas, the API client) comes from `packages/shared`.

## API Client

- The typed `fetch` wrapper lives in `packages/shared`.
- It is the **only** place that sets the acting-user header (`X-User-Id` today, a JWT later). Components, hooks, and routes never set it directly. See [security.md](./security.md#authentication).

## Module Resolution

- `apps/web` uses `"module": "ESNext"` with `"moduleResolution": "Bundler"`. This is a documented exception to the `NodeNext` rule in [architecture.md](./architecture.md#language--runtime): Vite resolves imports, so relative imports in `apps/web` have no `.js` extensions.
- The exception covers code inside `apps/web` only. `packages/shared` is consumed by both the API and the web app, so it stays on `NodeNext` with `.js` extensions: code written for `NodeNext` also resolves under `Bundler`, but not the other way around.

## Same-Origin Serving

- Web and API are served from one origin, so CORS is not needed (see [security.md](./security.md#cors)).
- **DEV:** the Vite dev server proxies API requests to the API.
- **PRD:** the built static files and the API share one origin. The exact serving mechanism is recorded here when implemented.

## Lint

- The root flat ESLint config (see [architecture.md](./architecture.md#tooling)) is extended for `apps/web` only with:
  - `eslint-plugin-react-hooks`
  - `eslint-plugin-jsx-a11y`

## Dependency and Front-End Security

- **Release cooldown:** `minimumReleaseAge: 4320` (3 days, in minutes) in `pnpm-workspace.yaml`, so pnpm never installs a version younger than 3 days. This matches Dependabot's 3-day wait (see [ci-cd.md](./ci-cd.md)). Malicious versions published from hijacked maintainer accounts are usually caught and unpublished within hours to days.
- **Build scripts:** no web package is added to the build-script allowlist (`.pnpmfile.cjs` / `allowBuilds` in `pnpm-workspace.yaml`). MSW's postinstall is not needed because tests use `msw/node`.
- **shadcn/ui CLI:** never a dependency; run it with an exact version (`pnpm dlx shadcn@<version>`). Generated code is reviewed in the PR like any other code.
- **Runtime exposure:** only the libraries bundled into the browser build reach production. Dev tooling (Vite, Vitest, MSW, jsdom, ESLint plugins) never ships, and the runtime image contains only the built static files.
- **Code rules:** no secrets in `VITE_*` env vars (Vite inlines them into the public bundle); no `dangerouslySetInnerHTML` (React escapes everything else by default); rely on `helmet`'s Content Security Policy (see [security.md](./security.md#security-headers)).

## Folder Layout

Suggested layout of `apps/web/src`:

```
apps/web/src/
  routes/              # route-level screens (or pages/)
  components/          # shared presentational components
    ui/                # shadcn/ui components
  features/
    <aggregate>/       # per-aggregate UI, queries, and mappers (account/, category/, transaction/)
      __test__/        # tests co-located with the code they cover
  lib/                 # shared helpers (money, dates, query client)
  __test__/            # tests for top-level code
```

## Testing

See [testing.md](./testing.md#web) for tools, levels, and test location.
