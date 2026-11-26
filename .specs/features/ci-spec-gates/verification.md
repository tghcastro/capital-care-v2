# CI spec-lean gates verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 10dcfe3
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `test_spec_gates.py` `test_red_feature_folder_fails` | yes - proofs green, asserts exit 1, `::error::` naming `half-done` and `no verification.md` |
| C2 | `test_spec_gates.py` `test_green_feature_folder_passes` | yes - `feat` title, code plus green folder, asserts exit 0 and the pass line |
| C3 | `test_spec_gates.py` `test_exempt_folder_is_skipped_and_does_not_count` | yes - asserts the skip, no validation error, and `no gated feature folder` with exit 1 (the exempt list is added by the PR itself; see Findings) |
| C4 | `test_spec_gates.py` `test_deleted_feature_folder_is_skipped` | yes - validating the deleted folder would fail on its missing checks.md, so exit 0 holds the claim |
| C5 | `test_spec_gates.py` `test_red_proof_fails`, `test_proofs_written_at_head` | yes - red proof fails at check_proofs.py and validate_verification.py never reports; proofs.md names `head[:7]` and the `pass` row |
| C6 | `test_spec_gates.py` `test_bad_commit_header_fails` | yes - asserts exit 1 and the error with the commit's short sha and `Added stuff` |
| C7 | `test_spec_gates.py` `test_missing_issue_footer_fails` | yes - valid header, no footer, asserts the footer error on that sha |
| C8 | `test_spec_gates.py` `test_merge_commits_are_skipped` | yes - the merge commit has neither a valid header nor a footer, so checking it would fail; asserts exit 0 and its sha absent |
| C9 | `test_spec_gates.py` `test_bad_title_fails` | yes - asserts exit 1 and the title error |
| C10 | `test_spec_gates.py` `test_dependabot_skips_commit_checks` | yes - commit lacks the footer and the title has an uppercase description, so both checks would fail if run; asserts exit 0 |
| C11 | `test_spec_gates.py` `test_code_without_feature_by_type`, `test_non_code_paths_pass` | yes - table-driven over all 8 code types (exit 1 and the `docs`/`chore` message) plus `docs`/`chore` exit 0, guarded by an equality with `check_commit.TYPES`; all four non-code path kinds under `feat` |
| C12 | `test_spec_gates.py` `test_workflow_wiring` | yes - text match, not YAML structure; I parsed the YAML separately: valid, trigger and steps as claimed, pins and pnpm/Node setup match ci-cd.yml |
| C13 | lone proof `grep -q 'spec-gates' docs/tech/definitions/ci-cd.md && ...` | yes - the grep only proves the strings appear; read by hand, ci-cd.md describes the job and the exempt list, and the template asks for the link |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| A PR can exempt its own red feature folder and pass | `read_exempt` reads `.github/spec-gates-exempt.txt` from the PR head. A throwaway run at HEAD: a `feat` PR that adds a green folder, a red folder with no verification.md, and `red` to the exempt list exits 0 (`skip red: listed in ...`, `spec-gates: PASS`) | read the exempt list at `--base` (`git show <base>:.github/spec-gates-exempt.txt`) so a PR can only remove entries; test a PR that adds its own folder to the list | |
| Non-ASCII paths are misclassified: a markdown doc counts as code, and a non-ASCII feature folder is never gated | `git diff --name-only` quotes non-ASCII paths (core.quotePath). A throwaway run at HEAD: a `feat` PR changing only `docs/naïve.md` exits 1 with `this PR changes code ("docs/na\303\257ve.md")`; `feature_of` returns None for any quoted `.specs/features/...` path, so that folder is skipped silently | run `git -c core.quotePath=false diff --name-only -z` (and split on NUL) in `main`; test a non-ASCII doc path and feature folder name | |
| A PR that adds or edits a feature folder with no checks.md yet (a plan-only `docs(specs)` PR) fails with only `check_proofs: no checks.md` | No check names this rule. A throwaway run at HEAD: `docs(specs): plan new` adding `.specs/features/new/plan.md` exits 1 with that message and no guidance | decide the rule: either skip a folder without `checks.md` (not counting it as gated) or state in ci-cd.md and the error message that a feature folder merges only with its checks, proofs and verification; add a check for the chosen behavior | |
| git.md still says the `Refs: CAP-<n>` footer is needed only "when the work comes from a Linear issue", while the job now requires it on every commit | `docs/tech/definitions/git.md:39` (conditional) vs `git.md:42` and `spec_gates.py:87` (always) | make line 39 state the footer is required on every commit in a PR | |
