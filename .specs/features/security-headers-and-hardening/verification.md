# Security headers and pipeline hardening verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 2f65e38
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `security-headers.component.test.ts` `sends the helmet headers on GET /health and no X-Powered-By` | yes - asserts 200 and all five headers; fails with helmet removed or mounted after `/health` (mutated both) |
| C2 | `security-headers.component.test.ts` `sends the helmet headers on a 401 from a protected route` | yes - the 401 is the real acting-user guard (`/categories` router); fails with helmet removed or mounted after the routers |
| C3 | `security-headers.component.test.ts` `sends the helmet headers on a 404 for an unknown route` | yes, but weak on position - reaches Express's own 404 and asserts `default-src 'none'`; fails when helmet is removed but still passes when helmet sits after the routers (the 404 is produced after every mount point) |
| C4 | `security-headers.component.test.ts` `sends the helmet headers on the web app at / when WEB_DIST_PATH is set` | yes, but weak on position - fails when helmet is removed, passes when helmet is mounted after the routers and before `express.static`; it only guards "static is not before helmet" |
| C5 | walk: built image at `http://127.0.0.1`, Chromium, `#root`, console | yes - behavioural, would show a CSP violation; not re-run, relies on the builder's walk |
| C6 | `pnpm install --frozen-lockfile && grep helmet && git diff --exit-code pnpm-lock.yaml` | yes - fails if `helmet` is missing from the manifest or the lockfile is stale |
| C7 | `check_timeouts.py` | yes for a missing or wrong value (mutated on a copy of the workflows: missing -> exit 1, 16 instead of 15 -> exit 1, key moved to a step -> exit 1, sixth job without limit -> exit 1); handles the plain `jobs:` layout. Gaps: a job whose key has uppercase, digit or underscore, or that has no `name:` line, is never counted, so an added job with no limit can pass (exit 0 on a no-`name:` job) |
| C8 | `pnpm audit` | yes - exits non-zero when any advisory remains |
| C9 | `pnpm test` | yes for regressions; it does not itself hold the overrides, only that nothing broke |
| C10 | `grep` of the three strings in `ci-cd.md` | no - greps for headings and strings only; it does not check the limits (15/10/20/15/30), so a wrong limit in the doc still passes |
| C11 | `pnpm lint` | yes - exits 0 (baseline), so a new failing file would fail it; lockfile has `minimatch@11.0.8` under ESLint |
| C12 | `pnpm type-check` | yes - fails if `helmet` does not resolve or its types change |
| C13 | `pnpm build` | yes - `tsc -b` plus vite build fail if the import does not compile |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Unplanned pipeline change, no check holds it: `persist-credentials: false` was added to all four `actions/checkout` steps (commit a41f1a8). The plan, the criteria and `ci-cd.md` say nothing of it, and the `publish` job then runs `git fetch ... origin` in "Verify tagged commit is on main", which needs the checkout credential when the repo is private. On a tag push this could fail the release gate with an auth error | `git diff origin/main..2f65e38 -- .github` (4 hunks); `ci-cd.yml` lines 150-158 | either drop `persist-credentials: false` from `publish` (or all), or add it to the plan as a criterion with a check and confirm the repo is public; the proofs cannot show it because no proof runs a tag push | |
| C10 proof does not hold AC 9's content: the job limits are never compared with the doc | `ci-cd.md` is checked by three `grep -q` for the heading and two override strings; the five minute values are not | add a grep for each limit line, or have `check_timeouts.py` also read the doc table | |
| `check_timeouts.py` can miss a sixth job: the job regex is `[a-z-]+` and requires a `name:` line directly after the key | throwaway copy: appended `extra:` job with no `name:` and no limit -> exit 0 | match any top-level key under `jobs:` (parse the YAML) | |
| C3 and C4 do not catch helmet moved below the routers | mutation: `app.use(helmet())` placed before `/categories` mounts - C1 and C2 fail (so the suite as a whole is red), but C3 and C4 stay green; only C1 and C2 hold the order, and they cover only `/health` and the routers, not the web-app static route | optional: add a test that mounts a throwing route or checks `GET /assets/x` headers after static to pin the order for static; low risk since C1/C2 already fail | |

Probed with no further defect:
- Helmet removed: all four tests fail. Helmet after routers: C1, C2 fail. Helmet after `/health` only: C1 fails.
- Own examples at 2f65e38 (throwaway test, deleted): malformed JSON body -> 400 through the error handler, `/health/` -> 200, `/HEALTH` -> 200, `/categories/` -> 401, `/%2e%2e/etc/passwd` and `/%E0%A4%A` -> 404, `/assets/nope.js` with static on -> 404, `HEAD /health` -> 200, a 200 KB JSON body -> 413 through the error handler. Every one carried nosniff, SAMEORIGIN, HSTS and a CSP, and none carried `X-Powered-By`. A true 500 from a handler was not provoked (no route throws on demand); the 400 and 413 use the same error handler.
- Overrides: lockfile resolves `esbuild@0.25.12` and `minimatch@11.0.8`; `pnpm lint` exits 0 and `drizzle-kit generate` (via `modules/ledger` with `drizzle.config.ts`) runs to "No schema changes", so neither tool broke.
