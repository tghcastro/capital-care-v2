# CI/CD

## Pipeline

Defined in [.github/workflows/ci-cd.yml](../../../.github/workflows/ci-cd.yml). Four jobs run in order:

```
test ──► security ──► build ──► publish
```

- **test:** install with the frozen lockfile, then type-check, build, and run all tests (`pnpm test`: the `node` Vitest project for the ledger module and the API app, and the `web` project for `apps/web`). Type-check, lint and build also cover `apps/web`.
- **security:** a production dependency audit that fails only on `critical` advisories. A second audit lists all advisories in the log and does not fail the run. On pull requests, dependency review also runs.
- **build:** build the `runtime` stage of the [Dockerfile](../../../Dockerfile). Load the image, start it, and check that `GET /health` returns `{"status":"ok"}` within 30 seconds, then that `GET /` returns `200` with `text/html` (the web app is served from the same image). The image is passed to the next job as an artifact (one-day retention, pushes only).
- **publish:** runs only on pushes to `main` and version tags, never on pull requests. It pushes the same image that was built and smoke-tested, not a rebuild.

## Triggers

| Event | Jobs that run |
|---|---|
| Pull request to `main` | test, security, build (no publish) |
| Push to `main` | test, security, build, publish |
| Push of a tag matching `v*.*.*` | test, security, build, publish |

Concurrent runs are cancelled for pull requests only. Runs on `main` and on tags always finish.

## Job Time Limits

Every job declares `timeout-minutes`, so a hung job ends on its own instead of running for the 6-hour default and holding the concurrency group.

| Job | Workflow | Limit (minutes) |
|---|---|---|
| test | ci-cd.yml | 15 |
| security | ci-cd.yml | 10 |
| build | ci-cd.yml | 20 |
| publish | ci-cd.yml | 15 |
| Analyze | codeql.yml | 30 |

## Image Registry and Tags

Images are published to GitHub Container Registry at `ghcr.io/tghcastro/capital-care-v2`.

| Trigger | Image tags |
|---|---|
| Push to `main` | `latest`, `sha-<7-char-sha>` |
| Push of tag `v1.2.3` | `1.2.3`, `1.2`, `sha-<7-char-sha>` (no `latest`) |

- The git tag `vX.Y.Z` is the source of truth for versions. Version fields in `package.json` are not edited for releases.
- A release tag must point at a commit reachable from `origin/main`. The publish job checks this with `git merge-base --is-ancestor` and fails before pushing otherwise.
- Every publish includes a build provenance attestation for the pushed image digest.

## Security Policy

- **Audit gate:** `critical` advisories in production dependencies block the pipeline. Lower severities are reported but do not block. `zod` has a `high` advisory whose fix is a major upgrade, so `high` is not a gate.
- **Permissions:** the workflow defaults to `contents: read`. Each job grants only what it needs. Only the publish job can write packages and attestations.
- **Checkout credentials:** every `actions/checkout` step sets `persist-credentials: false`, so the `GITHUB_TOKEN` is not left in `.git/config` for later steps. The publish job's `git fetch origin` works because the repository is public.
- **Secrets:** none. The pipeline uses the built-in `GITHUB_TOKEN`.
- **Action pinning:** every third-party action is pinned to a full commit SHA, with the release version in a trailing comment. Dependabot proposes updates to the pins.
- **CodeQL:** [.github/workflows/codeql.yml](../../../.github/workflows/codeql.yml) analyzes the TypeScript source on pull requests, pushes to `main`, and weekly. Code scanning default setup is disabled, because it conflicts with the workflow file.

## Dependency Overrides

`pnpm-workspace.yaml` pins two dev-only transitive packages whose parents have no release that clears their advisories yet, so `pnpm audit` reports no vulnerabilities:

- `@esbuild-kit/core-utils>esbuild` to `^0.25.12` (GHSA-67mh-4wv8-2f99, reached through `drizzle-kit`).
- `minimatch@>=10.0.0 <11.0.1` to `^11.0.8` (GHSA-g3hv-75wg-m249, reached through ESLint). `11.0.9` is newer than the repository's `minimumReleaseAge`, so the range resolves to `11.0.8`.

Remove an override when its parent package depends on a fixed version.

## Dependency Updates

Dependabot is configured in [.github/dependabot.yml](../../../.github/dependabot.yml) for three ecosystems: npm (the pnpm workspace), GitHub Actions, and Docker. Each runs weekly, waits 3 days after a release before proposing it, and keeps at most 5 pull requests open. npm minor and patch updates are grouped into one pull request.

Known limitation: the Dockerfile reads its Node version from `ARG NODE_VERSION`, which Dependabot may not parse. Node base image updates may need to be made by hand.
