# Plan: CI/CD pipeline (GitHub Actions, Dependabot, CodeQL, GHCR)

Status: **proposed — awaiting approval**. Implement only after the owner approves this document.

## Goal

Every change is tested and security-checked automatically. Merging to `main` (or pushing a version tag) builds the Docker image and publishes it to GitHub Container Registry (GHCR). Nothing requires secrets: the pipeline uses the built-in `GITHUB_TOKEN`.

```
PR or push to main or tag v*
  test ──► security ──► build ──► publish
                                  (publish runs only for main and tags, never for PRs)
```

## Decisions already made (do not re-litigate)

- Registry: **GHCR** (`ghcr.io/tghcastro/capital-care-v2`). The repository is public.
- **Trivy is out of scope** for now. Do not add it.
- Tags: `latest` + commit SHA on every `main` build; semver tags on releases (see [Tagging](#tagging)).
- Publish exactly the image that was built and checked (see [Build and publish](#3-build-and-publish)).
- Least privilege: workflow default `permissions: contents: read`; elevate per job only where needed.
- Pin every third-party action to a full commit SHA, with the version in a trailing comment.

## Defaults chosen by the planner (owner may change before approving)

1. **Lint is not part of the gate.** `pnpm lint` already fails on `main` (24 parser errors: `.eslintrc.json` sets `parserOptions.project: ./tsconfig.json`, and the root `tsconfig.json` does not include the source files). Fixing lint is a separate task: do not fix it here and do not add a lint step.
2. **Dependency audit gate:** fail only on `critical` advisories in production dependencies. `zod` currently has a `high` advisory whose fix is a 3.x → 4.x major bump, so gating on `high` would block everything. A second, non-blocking audit step reports everything.
3. **`latest` means "most recent build of `main`".** Release tags are immutable and are the versions to rely on.

## Tagging

- Source of truth for versions is the **git tag** `vX.Y.Z`, created manually: `git tag v0.1.0 && git push origin v0.1.0` (or via a GitHub Release). Do not edit the `version` fields in the `package.json` files.
- Semver tags are a small addition (one metadata rule), not extra complexity.
- Resulting image tags, produced by `docker/metadata-action`:

| Trigger | Image tags |
|---|---|
| push to `main` | `latest`, `sha-<7-char-sha>` |
| push of tag `v1.2.3` | `1.2.3`, `1.2`, `sha-<7-char-sha>` (no `latest`) |

- The release job must fail if the tagged commit is not reachable from `origin/main` (check with `git merge-base --is-ancestor`).

## Work items

Create these files on branch `chore/ci-cd-pipeline` (already created from `main`). One logical change per commit.

### 1. `.github/workflows/ci-cd.yml`

Triggers: `pull_request` (to `main`), `push` to `main`, `push` of tags matching `v*.*.*`. Add `concurrency` keyed by workflow + ref, cancelling in-progress runs for PRs only.

**Job `test`**
- `actions/checkout`, `pnpm/action-setup` (version taken from `packageManager` in `package.json`), `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`.
- `pnpm install --frozen-lockfile`
- `pnpm type-check`
- `pnpm build`
- `pnpm --filter @capital-care/ledger exec vitest run`
- CI calls vitest directly; the root `pnpm test` script runs `vitest run` over the whole workspace.

**Job `security`** (`needs: test`)
- Same setup and install as `test`.
- Blocking: `pnpm audit --prod --audit-level=critical`.
- Non-blocking (`continue-on-error: true`): `pnpm audit --prod` so all findings are visible in the log.
- On `pull_request` only: `actions/dependency-review-action` (fails PRs that introduce known-vulnerable dependencies).

**Job `build`** (`needs: security`)
- `docker/setup-buildx-action`, then `docker/build-push-action` with `target: runtime`, `push: false`, `tags: capital-care-api:ci`, `outputs: type=docker,dest=/tmp/image.tar`, GitHub Actions cache (`cache-from`/`cache-to: type=gha`).
- Smoke test: `docker load -i /tmp/image.tar`, run it detached (`-p 3000:3000`, no volume), poll `http://127.0.0.1:3000/health` (up to ~30 s), expect `{"status":"ok"}`, always print container logs and remove the container.
- On `push` events only (not PRs): `actions/upload-artifact` the tar (retention 1 day).

**Job `publish`** (`needs: build`; `if: github.event_name == 'push'`)
- `permissions`: `contents: read`, `packages: write`, `id-token: write`, `attestations: write`.
- For tag runs: first step verifies the tagged commit is an ancestor of `origin/main` (`fetch-depth: 0`); fail otherwise.
- `actions/download-artifact` for the tar, then `docker load -i`.
- `docker/login-action` to `ghcr.io` with `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}`.
- `docker/metadata-action` for tags (table above) and labels, including `org.opencontainers.image.source=https://github.com/tghcastro/capital-care-v2` (this links the package to the repo).
- Retag the loaded image `capital-care-api:ci` with every tag from the metadata step and `docker push` each. Capture the pushed digest (for example from `docker inspect --format '{{index .RepoDigests 0}}'`).
- `actions/attest-build-provenance` for the pushed digest (`push-to-registry: true`).
- **Fallback if retag-and-push proves unworkable:** rebuild with `docker/build-push-action` reusing the `type=gha` cache from the build job (`push: true`, `provenance: true`, `sbom: true`). If the fallback is used, state it clearly in the PR description, because the pushed image is then rebuilt rather than byte-identical to the scanned one.

### 2. `.github/workflows/codeql.yml`

- Triggers: `pull_request` to `main`, `push` to `main`, weekly `schedule`.
- Languages: `javascript-typescript`, `build-mode: none`.
- `permissions`: `contents: read`, `security-events: write`, `actions: read`.
- Uses `github/codeql-action/init` and `analyze`, pinned to a commit SHA.
- The owner must make sure GitHub's "default setup" for code scanning is **not** enabled at the same time (it conflicts with a workflow file).

### 3. `.github/dependabot.yml`

- `version: 2`. Update ecosystems, all `weekly`:
  - `npm` at `/` (covers the pnpm workspace lockfile). Group minor and patch updates together.
  - `github-actions` at `/`.
  - `docker` at `/`.
- Set `cooldown` (`default-days: 3`) on each ecosystem so brand-new releases are not proposed immediately.
- Limit open PRs (`open-pull-requests-limit: 5`).
- **Known limitation:** the Dockerfile builds its base image from `ARG NODE_VERSION`, which Dependabot's docker ecosystem may not parse. Do not rewrite the Dockerfile to work around this; mention it in the PR description so the owner can decide.

### 4. Documentation

- Add `docs/tech/definitions/ci-cd.md` describing, as decided facts only: the pipeline stages, triggers, the tagging table, the audit gate level, permissions policy, SHA pinning, Dependabot and CodeQL.
- Add a line for it to the "Decisions live in" list in `docs/tech/AGENTS.md` and to the matching "What to Read" guidance.
- Add a short README section: how to pull and run the published image (`docker pull ghcr.io/tghcastro/capital-care-v2:<tag>` and the existing compose usage), and how to cut a release (the tag commands above).

### 5. Pull request

Follow [docs/tech/definitions/git.md](../tech/definitions/git.md): Conventional Commit messages with the `Co-authored-by` trailer, PR title like `chore(ci): add test, scan, build and publish pipeline`, and fill in every section of `.github/PULL_REQUEST_TEMPLATE.md`. Do not merge the PR.

## Rules for the implementing agent

- Never invent a commit SHA for an action. Resolve each one from the action's official repository (the commit a release tag points to; for annotated tags, follow to the commit) and cross-check it. If a SHA cannot be verified, stop and report it.
- Do not add secrets, personal access tokens, or third-party registries.
- Do not modify `Dockerfile`, application source, `package.json` versions, or `.eslintrc.json`.
- Validate before committing: parse every YAML file (for example `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" <file>`) and run `actionlint` if it can be installed; run `pnpm install --frozen-lockfile && pnpm type-check && pnpm build && pnpm --filter @capital-care/ledger exec vitest run` locally to prove the commands used in the workflow work.
- The workflows cannot be fully verified locally. Say so in the PR, and list what to check on the first run.

## Manual steps for the owner (the agent cannot do these)

1. **Branch protection on `main`** (Settings → Rules): require pull requests, require the checks `test`, `security`, `build`, and CodeQL's `Analyze`, and require branches to be up to date.
2. **Actions settings:** keep default workflow permissions at read-only. Confirm Actions are enabled for the repository.
3. **Dependabot:** enable "Dependabot alerts" and "Dependabot security updates" (Settings → Code security).
4. **Code scanning:** make sure "default setup" is off, since the workflow file replaces it.
5. **GHCR visibility:** after the first publish, open the package settings and set it to public if it is not already (it should be linked to the repository through the `image.source` label).
6. **First release:** after the pipeline works on `main`, create `v0.1.0` and confirm the semver tags appear.

## Acceptance checks

- A PR runs `test`, `security`, `build` and CodeQL, and never publishes.
- A push to `main` publishes `latest` and `sha-<short>` to GHCR, with a provenance attestation.
- Pushing `v0.1.0` publishes `0.1.0`, `0.1` and `sha-<short>`, and does not move `latest`.
- Pushing a tag whose commit is not on `main` fails before publishing.
- A deliberately failing test, or a `critical` advisory, stops the pipeline before `build`.
- `docker run -p 3000:3000 ghcr.io/tghcastro/capital-care-v2:latest` starts and `/health` answers.

## Out of scope (future)

Trivy image scanning, lint in CI (needs the ESLint config fixed first), upgrading `zod` to 4.x, automated releases, deployment anywhere.
