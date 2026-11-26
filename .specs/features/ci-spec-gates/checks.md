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

17 checks in 4 slices · 0 one-way doors · 0 open

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

### S4 - Verifier findings

**C14** - A PR that adds its own red folder to `.github/spec-gates-exempt.txt` still fails on that folder, because the list is read at the base commit; a PR that removes an entry gets that folder gated.
Proof: run gates | test_pr_cannot_exempt_its_own_folder (test_spec_gates.FeatureFolderGate.test_pr_cannot_exempt_its_own_folder) ... ok
Proof: run gates | test_removed_exempt_entry_is_gated (test_spec_gates.FeatureFolderGate.test_removed_exempt_entry_is_gated) ... ok

**C15** - Non-ASCII paths are read raw: `docs/naïve.md` is not code, and a red folder `.specs/features/café` is gated and fails.
Proof: run gates | test_non_ascii_paths (test_spec_gates.FeatureFolderGate.test_non_ascii_paths) ... ok

**C16** - A feature folder with no `checks.md` yet (a plan-only `docs(specs)` PR) is skipped with `no checks.md yet` and exits 0, and it does not count as the feature folder of a code PR.
Proof: run gates | test_folder_without_checks_is_skipped (test_spec_gates.FeatureFolderGate.test_folder_without_checks_is_skipped) ... ok

**C17** - `docs/tech/definitions/git.md` states the `Refs: CAP-<n>` footer is required on every commit in a PR, not only when the work comes from a Linear issue.
Proof: `grep -q 'every commit in a PR references its Linear issue' docs/tech/definitions/git.md && ! grep -q 'when the work comes from a Linear issue, reference it' docs/tech/definitions/git.md`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| feature folder states (7) | red C1 · green C2 · exempt C3 · deleted C4 · self-exempted C14 · un-exempted C14 · no checks.md C16 | - |
| path encodings (2) | ASCII C11 · non-ASCII C15 | - |
| gated folder outcomes (3) | proof red C5 · proofs green, verification red C1 · both green C2 | - |
| commit message faults (3) | bad header C6 · no footer C7 · merge commit C8 | - |
| PR title type x code change (10 types) | C11, table-driven over all 10 of `check_commit.py`'s types | - |
| non-code path kinds (4) | `docs/` C11 · `.specs/` outside a feature C11 · `.prd/` C11 · `*.md` C11 | - |
| PR authors (2) | human C6 · `dependabot[bot]` C10 | - |
| workflow wiring (7) | trigger C12 · head sha C12 · fetch depth C12 · credentials C12 · timeout C12 · toolchain install C12 · env-passed inputs C12 | - |
| docs (3) | ci-cd.md C13 · PR template C13 · git.md C17 | - |

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
- **Dispatched:** Verifier at `10dcfe3` - returned, 4 findings
- **Boundary:** C1-C13 closed at `10dcfe3`; C14-C17 (Verifier findings) closed at `2bca82d`
- **Abandoned:** letting validate_verification.py accept a committed proofs.md at an earlier commit when only `.specs/` changed - `.gitignore` keeps proofs.md out of git, so CI runs check_proofs.py at the PR head instead and the skill scripts stay unchanged
