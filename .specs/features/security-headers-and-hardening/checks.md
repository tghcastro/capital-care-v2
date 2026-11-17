# Security headers and pipeline hardening checks

Build: `pnpm build`; `pnpm type-check`; `pnpm lint`
Run api: `pnpm exec vitest run apps/api/test/security-headers.component.test.ts --reporter=verbose 2>&1`
Plan: `.specs/features/security-headers-and-hardening/plan.md`

14 checks · 3 slices · 2 one-way doors · 0 open

## Checks

### S1 - Every response carries the helmet headers

**C1** - `GET /health` answers `200` with `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, a `Strict-Transport-Security` header with `max-age=`, a `Content-Security-Policy` containing `default-src 'self'`, and no `X-Powered-By` (AC 1)
Proof: run api | ✓ |node| apps/api/test/security-headers.component.test.ts > API app: security headers > sends the helmet headers on GET /health and no X-Powered-By

**C2** - `GET /categories` without the acting-user header answers `401` with the helmet headers (AC 2)
Proof: run api | ✓ |node| apps/api/test/security-headers.component.test.ts > API app: security headers > sends the helmet headers on a 401 from a protected route

**C3** - `GET /does-not-exist` answers `404` with the helmet headers, and a CSP of `default-src 'none'` (Express's own 404 handler replaces helmet's policy) (AC 2)
Proof: run api | ✓ |node| apps/api/test/security-headers.component.test.ts > API app: security headers > sends the helmet headers on a 404 for an unknown route

**C4** - With `WEB_DIST_PATH` set, `GET /` answers `200 text/html` and `GET /assets/index-abc123.js` answers `200` with the helmet headers (AC 3)
Proof: run api | ✓ |node| apps/api/test/security-headers.component.test.ts > API app: security headers > sends the helmet headers on the web app at / and on a static asset when WEB_DIST_PATH is set

**C5** - The built web app, served by the API at `http://127.0.0.1`, renders in Chromium (`#root` has a child, text "Capital Care") with no console message and no failed request, under the default CSP (AC 4)
Proof: walk - build, start `apps/api/dist/main.js` with `WEB_DIST_PATH=apps/web/dist`, open `/` in Chromium, read `#root`, the console and failed requests

**C6** - `helmet` is declared in `apps/api/package.json` and `pnpm install --frozen-lockfile` leaves `pnpm-lock.yaml` unchanged (AC 5)
Proof: `pnpm install --frozen-lockfile && grep -q '"helmet": "\^8.3.0"' apps/api/package.json && git diff --exit-code pnpm-lock.yaml`

### S2 - Every pipeline job has a time limit

**C7** - `test` 15, `security` 10, `build` 20, `publish` 15 in `ci-cd.yml` and `analyze` 30 in `codeql.yml` each declare `timeout-minutes`, and no job lacks a limit (AC 6)
Proof: `python3 -I .specs/features/security-headers-and-hardening/check_pipeline.py timeouts`

### S3 - The dependency audit is clean

**C8** - `pnpm audit` with no severity filter reports no vulnerabilities (AC 7)
Proof: `pnpm audit`

**C9** - `pnpm test` still passes in full after the overrides and the middleware (AC 8)
Proof: `pnpm test`

**C10** - `docs/tech/definitions/ci-cd.md` lists the same five limits (15/10/20/15/30) and both overrides (AC 9)
Proof: `python3 -I .specs/features/security-headers-and-hardening/check_pipeline.py docs`

**C11** - `pnpm lint` still exits 0 with `minimatch` 11 under ESLint (it exits 0 before the change) (AC 8)
Proof: `pnpm lint`

**C12** - `pnpm type-check` still exits 0 with `helmet` imported in `apps/api` (AC 8)
Proof: `pnpm type-check`

**C13** - `pnpm build` still exits 0, so the API and web app compile with the new dependency (AC 8)
Proof: `pnpm build`

**C14** - All four `actions/checkout` steps in `ci-cd.yml` (test, security, build, publish) and the one in `codeql.yml` set `persist-credentials: false` (AC 10)
Proof: `python3 -I .specs/features/security-headers-and-hardening/check_pipeline.py checkouts`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| response kinds that carry the headers (5) | 200 route C1 · 401 error C2 · 404 error C3 · static `/` C4 · static asset C4 | - |
| helmet headers asserted (5) | `X-Content-Type-Options` C1 · `X-Frame-Options` C1 · `Strict-Transport-Security` C1 · `Content-Security-Policy` C1 · no `X-Powered-By` C1 (C2, C3 and C4 assert the same five on their responses) | - |
| pipeline jobs (5) | test C7 · security C7 · build C7 · publish C7 · analyze C7 | - |
| checkout steps (5) | test C14 · security C14 · build C14 · publish C14 · analyze C14 | - |
| overrides (2) | `@esbuild-kit/core-utils>esbuild` C8, C10 · `minimatch@>=10.0.0 <11.0.1` C8, C10 | - |
| regression commands, AC 8 (4) | build C13 · type-check C12 · lint C11 · test C9 | - |

## Swept

- validation: n/a - no input is read or accepted by this change
- failure modes: C2, C3 (error responses keep the headers)
- idempotency: n/a - no state changes
- authorization: existing - the acting-user guard answers 401 (C2 shows it still does, with headers)
- concurrency: n/a - stateless middleware
- data lifecycle: n/a - nothing stored or changed
- dependency failure: n/a - no external call
- state transitions: n/a - none
- observability: n/a - no logging requirement; the CI smoke test and `HEALTHCHECK` read only status and content-type

## Handoff

- **Settled mid-build:** user approved the plan ("approved"); user chose helmet defaults, job timeouts and the two audit findings in scope, raw-body out of scope
- **Dispatched:** Verifier at `2f65e38` (diff range `origin/main..2f65e38`)
- **Boundary:** C1-C13 closed at `2f65e38`
- **Abandoned:** `check_timeouts.py` - replaced by `check_pipeline.py` after the Verifier showed it missed jobs without a `name:` line;  `minimatch` override `^11.0.9` - published inside the repo's 3-day `minimumReleaseAge`, so install fails; used `^11.0.8`
- **Walked:** C5 - built the web app, started the API with `WEB_DIST_PATH`, opened `http://127.0.0.1:3411/` in Chromium: title "Capital Care", `#root` has 1 child, body text starts "Capital Care | Signed in as alice | ... Month ...", console empty, no failed requests
