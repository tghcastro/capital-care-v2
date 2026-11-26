# CI spec-lean gates checks

Build: `python3 -m py_compile scripts/spec_gates.py scripts/test_spec_gates.py`
Run gates: `python3 -m unittest discover -s scripts -p 'test_*.py' -v`

## Intent

The spec-lean gates (`validate_verification.py`, `check_commit.py`) only run when an agent runs
them, so a pull request can merge with a feature folder that has no `proofs.md` or no
`verification.md`, or with commits that break the commit pattern. After this ships, every pull
request to `main` runs a `spec-gates` job: for each feature folder the PR changes under
`.specs/features/`, the job runs `check_proofs.py` at the PR head (`proofs.md` is gitignored
because it must name the exact HEAD, so CI writes it) and then `validate_verification.py`, and
either one failing fails the job; every non-merge commit in the PR must pass `check_commit.py` and
carry a `Refs: CAP-<n>` footer; the PR title must follow the commit pattern; and a PR that changes
code with no gated feature folder fails unless its title type is `docs` or `chore`. Feature folders
that predate the job and do not pass yet are listed in `.github/spec-gates-exempt.txt`: they are
skipped, and they do not count as the feature folder of a code PR. The PR template gains a
`## Verification` field that links the feature's `verification.md`.

13 checks in 3 slices · 0 one-way doors · 0 open

## Checks

### S1 - Feature folders

**C1** - A PR that changes a feature folder whose proofs pass but whose `validate_verification.py` exits non-zero (no `verification.md`) makes `spec_gates.py` exit 1 and print `::error::` naming that folder.
Proof: run gates | test_red_feature_folder_fails (test_spec_gates.FeatureFolderGate.test_red_feature_folder_fails) ... ok

**C2** - A `feat` PR that changes code and a feature folder that passes `validate_verification.py` makes `spec_gates.py` exit 0.
Proof: run gates | test_green_feature_folder_passes (test_spec_gates.FeatureFolderGate.test_green_feature_folder_passes) ... ok

**C3** - A folder listed in `.github/spec-gates-exempt.txt` is not validated, and a `feat` PR whose only feature folder is exempt fails as having no feature folder.
Proof: run gates | test_exempt_folder_is_skipped_and_does_not_count (test_spec_gates.FeatureFolderGate.test_exempt_folder_is_skipped_and_does_not_count) ... ok

**C4** - A feature folder the PR deletes is not validated.
Proof: run gates | test_deleted_feature_folder_is_skipped (test_spec_gates.FeatureFolderGate.test_deleted_feature_folder_is_skipped) ... ok

**C5** - A gated folder whose proof fails at the PR head fails at `check_proofs.py`, before `validate_verification.py` runs; with green proofs, `proofs.md` is written naming the PR head's short sha and a `pass` row per check.
Proof: run gates | test_red_proof_fails (test_spec_gates.ProofsAtHead.test_red_proof_fails) ... ok
Proof: run gates | test_proofs_written_at_head (test_spec_gates.ProofsAtHead.test_proofs_written_at_head) ... ok

### S2 - Commits and title

**C6** - A PR commit whose header breaks Conventional Commits (e.g. `Added stuff`) fails, and the error names the commit's short sha.
Proof: run gates | test_bad_commit_header_fails (test_spec_gates.CommitGate.test_bad_commit_header_fails) ... ok

**C7** - A PR commit with a valid header and no `Refs: CAP-<n>` footer fails.
Proof: run gates | test_missing_issue_footer_fails (test_spec_gates.CommitGate.test_missing_issue_footer_fails) ... ok

**C8** - Merge commits in the PR are not checked.
Proof: run gates | test_merge_commits_are_skipped (test_spec_gates.CommitGate.test_merge_commits_are_skipped) ... ok

**C9** - A PR title that breaks the commit pattern (e.g. `Update docs`) fails.
Proof: run gates | test_bad_title_fails (test_spec_gates.CommitGate.test_bad_title_fails) ... ok

**C10** - A PR opened by `dependabot[bot]` skips the commit and title checks (its `chore(deps): Bump ...` messages would fail) and passes.
Proof: run gates | test_dependabot_skips_commit_checks (test_spec_gates.CommitGate.test_dependabot_skips_commit_checks) ... ok

### S3 - Code without a feature, CI wiring, docs

**C11** - A PR that changes code with no gated feature folder fails with a message naming `docs`/`chore` for each code type `feat`, `fix`, `refactor`, `test`, `perf`, `style`, `build`, `ci`, and passes for `docs` and `chore`; a PR that changes only `docs/`, `.specs/` outside a feature folder, `.prd/` or `*.md` files passes as `feat`.
Proof: run gates | test_code_without_feature_by_type (test_spec_gates.CodeWithoutFeature.test_code_without_feature_by_type) ... ok
Proof: run gates | test_non_code_paths_pass (test_spec_gates.CodeWithoutFeature.test_non_code_paths_pass) ... ok

**C12** - `.github/workflows/spec-gates.yml` runs on `pull_request` to `main` (including `edited`), checks out the PR head sha with `fetch-depth: 0` and `persist-credentials: false`, sets `timeout-minutes`, installs Node from `.nvmrc` and the dependencies with `pnpm install --frozen-lockfile`, runs the unit tests, and runs `scripts/spec_gates.py` with the base sha, head sha, title and author passed through `env`.
Proof: run gates | test_workflow_wiring (test_spec_gates.Workflow.test_workflow_wiring) ... ok

**C13** - `docs/tech/definitions/ci-cd.md` describes the `spec-gates` job and the exempt list, and the PR template has a `## Verification` field that asks for the `verification.md` link.
Proof: `grep -q 'spec-gates' docs/tech/definitions/ci-cd.md && grep -q 'spec-gates-exempt.txt' docs/tech/definitions/ci-cd.md && grep -q '^## Verification' .github/PULL_REQUEST_TEMPLATE.md && grep -q 'verification.md' .github/PULL_REQUEST_TEMPLATE.md`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| feature folder states (4) | red C1 · green C2 · exempt C3 · deleted C4 | - |
| gated folder outcomes (3) | proof red C5 · proofs green, verification red C1 · both green C2 | - |
| commit message faults (3) | bad header C6 · no footer C7 · merge commit C8 | - |
| PR title type x code change (10 types) | C11, table-driven over all 10 of `check_commit.py`'s types | - |
| non-code path kinds (4) | `docs/` C11 · `.specs/` outside a feature C11 · `.prd/` C11 · `*.md` C11 | - |
| PR authors (2) | human C6 · `dependabot[bot]` C10 | - |
| workflow wiring (7) | trigger C12 · head sha C12 · fetch depth C12 · credentials C12 · timeout C12 · toolchain install C12 · env-passed inputs C12 | - |
| docs (2) | ci-cd.md C13 · PR template C13 | - |

## Swept

- validation: C6, C7, C9, C11
- failure modes: C5 - a proof that fails at the PR head fails the job before the verification is read
- idempotency: n/a - the job reads git and writes nothing
- authorization: C12 - `contents: read`, inputs passed through `env`, never interpolated into the script
- concurrency: n/a - one run per PR, superseded runs cancelled
- data lifecycle: C4
- dependency failure: existing - a failing `validate_verification.py` or `check_commit.py` subprocess is a red gate (C1, C6)
- state transitions: n/a - no state
- observability: C1, C6 - each failure is an `::error::` annotation naming the folder, commit or rule

## Out of scope

- Making the check required in branch protection: a repository setting, not a file in this repo.
- Fixing the existing feature folders that do not pass yet: listed as exempt instead.

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none
- **Boundary:** none yet
- **Abandoned:** none
