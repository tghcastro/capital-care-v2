"""Tests for spec_gates.py and the proofs.md HEAD rule of validate_verification.py.

Each test builds a throwaway git repository with a base commit on `main` and a PR branch on top.
Run: python3 -m unittest discover -s scripts -p 'test_*.py' -v
"""

import contextlib
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SKILL = os.path.join(REPO, ".claude", "skills", "tlc-spec-lean", "scripts")
sys.path.insert(0, HERE)
sys.path.insert(0, SKILL)

import check_commit  # noqa: E402
import spec_gates  # noqa: E402

GOOD = "Refs: CAP-1"

MINI_CHECKS = """# Mini checks

Build: none - a throwaway repository
Run t: `python3 -c "print('{line}')"`

## Intent

A throwaway feature whose one proof prints a line.

1 check in 1 slice · 0 one-way doors · 0 open

## Checks

### S1 - One

**C1** - The one test passes.
Proof: run t | test_one ... ok

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| tests (1) | one C1 | - |

## Swept

- validation: n/a - throwaway
- failure modes: n/a - throwaway
- idempotency: n/a - throwaway
- authorization: n/a - throwaway
- concurrency: n/a - throwaway
- data lifecycle: n/a - throwaway
- dependency failure: n/a - throwaway
- state transitions: n/a - throwaway
- observability: n/a - throwaway

## Out of scope

- everything else

## Handoff

- **Dispatched:** none
"""

MINI_VERIFICATION = """# Mini verification

**Verdict**: PASS
**Proofs**: `proofs.md` at HEAD
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `test_one` | yes |

## Findings

None - a throwaway feature.
"""


class Repo:
    def __init__(self):
        self.root = tempfile.mkdtemp(prefix="spec-gates-")
        shutil.copytree(SKILL, os.path.join(self.root, spec_gates.SKILL_SCRIPTS),
                        ignore=shutil.ignore_patterns("__pycache__", "fixtures"))
        self.git("init", "-q", "-b", "main")
        self.write("README.md", "base\n")
        self.write(".gitignore", "__pycache__/\n")
        self.base = self.commit("chore: base\n\n" + GOOD)
        self.git("checkout", "-q", "-b", "pr")

    def git(self, *args):
        p = subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args], cwd=self.root,
                           capture_output=True, text=True)
        assert p.returncode == 0, p.stderr
        return p.stdout.strip()

    def write(self, path, text):
        full = os.path.join(self.root, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(text)

    def remove(self, path):
        shutil.rmtree(os.path.join(self.root, path))

    def commit(self, message):
        self.git("add", "-A")
        self.git("commit", "-q", "--allow-empty", "-m", message)
        return self.git("rev-parse", "HEAD")

    def head(self):
        return self.git("rev-parse", "HEAD")

    def feature(self, name, line="test_one ... ok", verification=True):
        """A feature folder with one `run` proof whose command prints `line`. With the default line
        and a verification.md it passes check_proofs.py and validate_verification.py."""
        fdir = f".specs/features/{name}"
        self.write(f"{fdir}/checks.md", MINI_CHECKS.format(line=line))
        if verification:
            self.write(f"{fdir}/verification.md", MINI_VERIFICATION)

    def gates(self, title="feat(billing): add dunning", author="someone"):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = spec_gates.main(["--base", self.base, "--head", self.head(), "--title", title,
                                    "--author", author, "--root", self.root])
        return code, out.getvalue()

    def close(self):
        shutil.rmtree(self.root, ignore_errors=True)


class RepoTest(unittest.TestCase):
    def setUp(self):
        self.repo = Repo()

    def tearDown(self):
        self.repo.close()


class FeatureFolderGate(RepoTest):
    def test_red_feature_folder_fails(self):
        self.repo.feature("half-done", verification=False)
        self.repo.write("src/app.ts", "export const a = 1\n")
        self.repo.commit("feat(app): half done\n\n" + GOOD)
        code, out = self.repo.gates()
        self.assertEqual(code, 1, out)
        self.assertIn("::error::feature folder `half-done` fails validate_verification.py", out)
        self.assertIn("no verification.md", out)

    def test_green_feature_folder_passes(self):
        self.repo.feature("billing")
        self.repo.write("src/billing.ts", "export const b = 1\n")
        self.repo.commit("feat(billing): add dunning\n\n" + GOOD)
        code, out = self.repo.gates()
        self.assertEqual(code, 0, out)
        self.assertIn("pass   billing: check_proofs.py and validate_verification.py", out)

    def test_exempt_folder_is_skipped_and_does_not_count(self):
        self.repo.git("checkout", "-q", "main")
        self.repo.write(".github/spec-gates-exempt.txt", "# legacy\nlegacy  # no proofs.md yet\n")
        self.repo.base = self.repo.commit("chore: exempt legacy\n\n" + GOOD)
        self.repo.git("checkout", "-q", "-B", "pr")
        self.repo.write(".specs/features/legacy/checks.md", "# Legacy checks\n")
        self.repo.write("src/app.ts", "export const a = 1\n")
        self.repo.commit("feat(app): touch legacy\n\n" + GOOD)
        code, out = self.repo.gates()
        self.assertEqual(code, 1, out)
        self.assertIn("skip   legacy: listed in .github/spec-gates-exempt.txt at the base commit", out)
        self.assertNotIn("feature folder `legacy` fails", out)
        self.assertIn("no gated feature folder", out)

    def test_pr_cannot_exempt_its_own_folder(self):
        self.repo.feature("green")
        self.repo.feature("red", verification=False)
        self.repo.write(".github/spec-gates-exempt.txt", "red\n")
        self.repo.write("src/app.ts", "export const a = 1\n")
        self.repo.commit("feat(app): exempt myself\n\n" + GOOD)
        code, out = self.repo.gates()
        self.assertEqual(code, 1, out)
        self.assertIn("::error::feature folder `red` fails validate_verification.py", out)

    def test_removed_exempt_entry_is_gated(self):
        self.repo.git("checkout", "-q", "main")
        self.repo.write(".github/spec-gates-exempt.txt", "red\n")
        self.repo.base = self.repo.commit("chore: exempt red\n\n" + GOOD)
        self.repo.git("checkout", "-q", "-B", "pr")
        self.repo.write(".github/spec-gates-exempt.txt", "")
        self.repo.feature("red", verification=False)
        self.repo.commit("docs(specs): red\n\n" + GOOD)
        code, out = self.repo.gates(title="docs(specs): red")
        self.assertEqual(code, 1, out)
        self.assertIn("::error::feature folder `red` fails validate_verification.py", out)

    def test_folder_without_checks_is_skipped(self):
        self.repo.write(".specs/features/new/plan.md", "# New plan\n")
        self.repo.commit("docs(specs): plan new\n\n" + GOOD)
        code, out = self.repo.gates(title="docs(specs): plan new")
        self.assertEqual(code, 0, out)
        self.assertIn("skip   new: no checks.md yet, so nothing to prove", out)
        self.repo.write("src/app.ts", "export const a = 1\n")
        self.repo.commit("feat(app): code with a plan only\n\n" + GOOD)
        code, out = self.repo.gates(title="feat(app): code with a plan only")
        self.assertEqual(code, 1, out)
        self.assertIn("no gated feature folder", out)

    def test_non_ascii_paths(self):
        self.repo.write("docs/naïve.md", "x\n")
        self.repo.feature("café", verification=False)
        self.repo.commit("docs(specs): café\n\n" + GOOD)
        code, out = self.repo.gates(title="docs(specs): café")
        self.assertEqual(code, 1, out)
        self.assertIn("::error::feature folder `café` fails validate_verification.py", out)
        self.assertNotIn("changes code", out)

    def test_deleted_feature_folder_is_skipped(self):
        self.repo.git("checkout", "-q", "main")
        self.repo.write(".specs/features/old/checks.md", "# Old checks\n")
        self.repo.base = self.repo.commit("docs(specs): old\n\n" + GOOD)
        self.repo.git("checkout", "-q", "-B", "pr")
        self.repo.remove(".specs/features/old")
        self.repo.commit("docs(specs): remove old\n\n" + GOOD)
        code, out = self.repo.gates(title="docs(specs): remove old")
        self.assertEqual(code, 0, out)
        self.assertIn("skip   old: deleted by this PR", out)


class ProofsAtHead(RepoTest):
    def test_red_proof_fails(self):
        self.repo.feature("billing", line="test_one ... FAILED")
        self.repo.write("src/billing.ts", "export const b = 1\n")
        self.repo.commit("feat(billing): add dunning\n\n" + GOOD)
        code, out = self.repo.gates()
        self.assertEqual(code, 1, out)
        self.assertIn("::error::feature folder `billing` fails check_proofs.py at the PR head", out)
        self.assertNotIn("fails validate_verification.py", out)

    def test_proofs_written_at_head(self):
        self.repo.feature("billing")
        self.repo.write("src/billing.ts", "export const b = 1\n")
        head = self.repo.commit("feat(billing): add dunning\n\n" + GOOD)
        code, out = self.repo.gates()
        self.assertEqual(code, 0, out)
        with open(os.path.join(self.repo.root, ".specs/features/billing/proofs.md"), encoding="utf-8") as f:
            proofs = f.read()
        self.assertRegex(proofs, r"\*\*HEAD\*\*: " + head[:7])
        self.assertIn("| C1 | `run t / test_one ... ok` | pass |", proofs)


class CommitGate(RepoTest):
    def test_bad_commit_header_fails(self):
        sha = self.repo.commit("Added stuff\n\n" + GOOD)
        code, out = self.repo.gates(title="docs: stuff")
        self.assertEqual(code, 1, out)
        self.assertIn(f"::error::commit {sha[:7]} 'Added stuff'", out)

    def test_missing_issue_footer_fails(self):
        sha = self.repo.commit("docs: add notes")
        code, out = self.repo.gates(title="docs: add notes")
        self.assertEqual(code, 1, out)
        self.assertIn(f"::error::commit {sha[:7]} 'docs: add notes': no `Refs: CAP-<n>` footer", out)

    def test_merge_commits_are_skipped(self):
        self.repo.git("checkout", "-q", "main")
        self.repo.write("other.md", "x\n")
        self.repo.commit("docs: other\n\n" + GOOD)
        self.repo.git("checkout", "-q", "pr")
        self.repo.commit("docs: mine\n\n" + GOOD)
        self.repo.git("-c", "user.email=t@t", "-c", "user.name=t", "merge", "-q", "--no-edit", "main")
        merge = self.repo.head()
        self.assertIn("Merge branch", self.repo.git("log", "-1", "--format=%s"))
        code, out = self.repo.gates(title="docs: mine")
        self.assertEqual(code, 0, out)
        self.assertNotIn(merge[:7], out)

    def test_bad_title_fails(self):
        self.repo.commit("docs: add notes\n\n" + GOOD)
        code, out = self.repo.gates(title="Update docs")
        self.assertEqual(code, 1, out)
        self.assertIn("::error::PR title 'Update docs' breaks the commit pattern", out)

    def test_dependabot_skips_commit_checks(self):
        self.repo.write("package.json", "{}\n")
        self.repo.commit("chore(deps): Bump vitest from 5.1.0 to 5.1.1")
        code, out = self.repo.gates(title="chore(deps): Bump vitest from 5.1.0 to 5.1.1",
                                    author="dependabot[bot]")
        self.assertEqual(code, 0, out)
        self.assertIn("skip   commit and title checks: PR opened by dependabot[bot]", out)


class CodeWithoutFeature(RepoTest):
    CODE_TYPES = ("feat", "fix", "refactor", "test", "perf", "style", "build", "ci")

    def test_code_without_feature_by_type(self):
        self.repo.write("src/app.ts", "export const a = 1\n")
        self.repo.commit("chore(app): change\n\n" + GOOD)
        self.assertEqual(set(self.CODE_TYPES) | {"docs", "chore"},
                         set(check_commit.TYPES))
        for ctype in self.CODE_TYPES:
            with self.subTest(ctype=ctype):
                code, out = self.repo.gates(title=f"{ctype}(app): change")
                self.assertEqual(code, 1, out)
                self.assertIn(f"no gated feature folder under .specs/features/ and its title type is "
                              f"`{ctype}`", out)
                self.assertIn("use the `docs` or `chore` type", out)
        for ctype in ("docs", "chore"):
            with self.subTest(ctype=ctype):
                code, out = self.repo.gates(title=f"{ctype}(app): change")
                self.assertEqual(code, 0, out)

    def test_non_code_paths_pass(self):
        self.repo.write("docs/tech/x.md", "x\n")
        self.repo.write(".specs/STATE.md", "x\n")
        self.repo.write(".prd/idea.md", "x\n")
        self.repo.write(".prd/notes.txt", "x\n")
        self.repo.write("apps/web/README.md", "x\n")
        self.repo.commit("feat: docs only\n\n" + GOOD)
        code, out = self.repo.gates(title="feat: docs only")
        self.assertEqual(code, 0, out)


class Workflow(unittest.TestCase):
    def test_workflow_wiring(self):
        with open(os.path.join(REPO, ".github", "workflows", "spec-gates.yml"), encoding="utf-8") as f:
            text = f.read()
        self.assertRegex(text, r"(?m)^on:\n  pull_request:\n    branches: \[main\]\n"
                               r"    types: \[opened, synchronize, reopened, edited\]")
        self.assertIn("ref: ${{ github.event.pull_request.head.sha }}", text)
        self.assertIn("fetch-depth: 0", text)
        self.assertIn("persist-credentials: false", text)
        self.assertRegex(text, r"timeout-minutes: \d+")
        # The proofs are the project's own test commands, so the job installs the toolchain first.
        self.assertIn("pnpm install --frozen-lockfile", text)
        self.assertIn("node-version-file: .nvmrc", text)
        self.assertIn("python3 -m unittest discover -s scripts -p 'test_*.py' -v", text)
        for var, expr in (("BASE_SHA", "github.event.pull_request.base.sha"),
                          ("HEAD_SHA", "github.event.pull_request.head.sha"),
                          ("PR_TITLE", "github.event.pull_request.title"),
                          ("PR_AUTHOR", "github.event.pull_request.user.login")):
            self.assertIn(f"{var}: ${{{{ {expr} }}}}", text)
        self.assertIn('python3 scripts/spec_gates.py --base "$BASE_SHA" --head "$HEAD_SHA" '
                      '--title "$PR_TITLE" --author "$PR_AUTHOR"', text)
        # Inputs reach the script only through env, never interpolated into the shell.
        run_lines = [ln for ln in text.splitlines() if "spec_gates.py" in ln]
        self.assertTrue(all("${{" not in ln for ln in run_lines), run_lines)


if __name__ == "__main__":
    unittest.main()
