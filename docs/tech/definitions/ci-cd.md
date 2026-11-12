# CI/CD

## Pipeline

Defined in [.github/workflows/ci-cd.yml](../../../.github/workflows/ci-cd.yml). Four jobs run in order:

```
test ──► security ──► build ──► publish
```

- **test:** install with the frozen lockfile, then type-check, build, and run all tests (`pnpm test`: the ledger module and the API app).
- **security:** a production dependency audit that fails only on `critical` advisories. A second audit lists all advisories in the log and does not fail the run. On pull requests, dependency review also runs.
- **build:** build the `runtime` stage of the [Dockerfile](../../../Dockerfile). Load the image, start it, and check that `GET /health` returns `{"status":"ok"}` within 30 seconds. The image is passed to the next job as an artifact (one-day retention, pushes only).
- **publish:** runs only on pushes to `main` and version tags, never on pull requests. It pushes the same image that was built and smoke-tested, not a rebuild.

## Triggers

| Event | Jobs that run |
|---|---|
| Pull request to `main` | test, security, build (no publish) |
| Push to `main` | test, security, build, publish |
| Push of a tag matching `v*.*.*` | test, security, build, publish |

Concurrent runs are cancelled for pull requests only. Runs on `main` and on tags always finish.

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
- **Lint:** not part of the pipeline. `pnpm lint` currently fails with 24 parser errors, because the ESLint configuration points at a `tsconfig.json` that does not include the source files.
- **Permissions:** the workflow defaults to `contents: read`. Each job grants only what it needs. Only the publish job can write packages and attestations.
- **Secrets:** none. The pipeline uses the built-in `GITHUB_TOKEN`.
- **Action pinning:** every third-party action is pinned to a full commit SHA, with the release version in a trailing comment. Dependabot proposes updates to the pins.
- **CodeQL:** [.github/workflows/codeql.yml](../../../.github/workflows/codeql.yml) analyzes the TypeScript source on pull requests, pushes to `main`, and weekly. Code scanning default setup is disabled, because it conflicts with the workflow file.

## Dependency Updates

Dependabot is configured in [.github/dependabot.yml](../../../.github/dependabot.yml) for three ecosystems: npm (the pnpm workspace), GitHub Actions, and Docker. Each runs weekly, waits 3 days after a release before proposing it, and keeps at most 5 pull requests open. npm minor and patch updates are grouped into one pull request.

Known limitation: the Dockerfile reads its Node version from `ARG NODE_VERSION`, which Dependabot may not parse. Node base image updates may need to be made by hand.
