#!/usr/bin/env python3
"""
spec_gates.py - the spec-lean gates a pull request must pass (CI job `spec-gates`).

  1. Every feature folder the PR changes under `.specs/features/` passes `check_proofs.py` (run
     here, at the PR head, because proofs.md is never committed) and then
     `validate_verification.py`, unless `.github/spec-gates-exempt.txt` lists it.
  2. Every non-merge commit in the PR passes `check_commit.py` and has a `Refs: CAP-<n>` footer.
  3. The PR title passes `check_commit.py` (it becomes the squash commit on `main`).
  4. A PR that changes code with no gated feature folder has the title type `docs` or `chore`.

Checks 2 and 3 are skipped for PRs opened by Dependabot, whose messages do not follow the pattern.

Usage:
  python3 scripts/spec_gates.py --base <sha> --head <sha> --title "<PR title>" --author <login>

The working tree must be checked out at --head, with the project's dependencies installed so the
proofs can run. Standard library only.
Exit codes: 0 every gate passes, 1 a gate fails.
"""

import argparse
import os
import re
import subprocess
import sys

SKILL_SCRIPTS = os.path.join(".claude", "skills", "tlc-spec-lean", "scripts")
EXEMPT_FILE = os.path.join(".github", "spec-gates-exempt.txt")
FEATURES_PREFIX = ".specs/features/"
NON_CODE_PREFIXES = ("docs/", ".specs/", ".prd/", ".prompts/")
NO_FEATURE_TYPES = ("docs", "chore")
BOT_AUTHORS = ("dependabot[bot]",)
ISSUE_FOOTER_RE = re.compile(r"^Refs: CAP-\d+\s*$", re.MULTILINE)
TITLE_TYPE_RE = re.compile(r"^(?P<type>\w+)(?:\([^)]+\))?!?: ")


class GitError(Exception):
    pass


def git(root, *args):
    p = subprocess.run(["git", *args], cwd=root, capture_output=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {p.stderr.strip()}")
    return p.stdout


def is_code(path):
    """A path that is not documentation or specs."""
    return not (path.startswith(NON_CODE_PREFIXES) or path.endswith(".md"))


def feature_of(path):
    """The feature folder name a path sits in, or None."""
    if not path.startswith(FEATURES_PREFIX):
        return None
    rest = path[len(FEATURES_PREFIX):].split("/")
    return rest[0] if len(rest) > 1 else None


def read_exempt(root):
    path = os.path.join(root, EXEMPT_FILE)
    if not os.path.isfile(path):
        return set()
    with open(path, encoding="utf-8") as f:
        return {ln.split("#", 1)[0].strip() for ln in f} - {""}


def title_type(title):
    m = TITLE_TYPE_RE.match(title or "")
    return m.group("type") if m else None


def run_script(root, name, *args):
    p = subprocess.run([sys.executable, os.path.join(root, SKILL_SCRIPTS, name), *args], cwd=root,
                       capture_output=True, encoding="utf-8", errors="replace")
    return p.returncode, (p.stdout + p.stderr).strip()


def check_message(root, message):
    """Errors for one commit message: the Conventional Commits check and the issue footer."""
    errors = []
    code, out = run_script(root, "check_commit.py", "--message", message, "--root", root)
    if code != 0:
        errors += [ln.strip() for ln in out.splitlines() if ln.strip().startswith("ERROR")] or [out]
    if not ISSUE_FOOTER_RE.search(message):
        errors.append("no `Refs: CAP-<n>` footer (docs/tech/definitions/git.md)")
    return errors


def feature_gate(root, changed):
    """(errors, gated folder names) for the feature folders the PR changes."""
    exempt = read_exempt(root)
    errors, gated = [], []
    for name in sorted({f for f in map(feature_of, changed) if f}):
        if not os.path.isdir(os.path.join(root, FEATURES_PREFIX, name)):
            print(f"skip   {name}: deleted by this PR")
            continue
        if name in exempt:
            print(f"skip   {name}: listed in {EXEMPT_FILE}")
            continue
        gated.append(name)
        # proofs.md is never committed (it names the exact HEAD), so the job writes it here.
        code, out = run_script(root, "check_proofs.py", name, "--root", root)
        if code != 0:
            errors.append(f"feature folder `{name}` fails check_proofs.py at the PR head:\n{out}")
            continue
        code, out = run_script(root, "validate_verification.py", name, "--root", root)
        if code == 0:
            print(f"pass   {name}: check_proofs.py and validate_verification.py")
        else:
            errors.append(f"feature folder `{name}` fails validate_verification.py:\n{out}")
    return errors, gated


def commit_gate(root, base, head, title):
    errors = []
    code, out = run_script(root, "check_commit.py", "--message", title, "--root", root)
    if code != 0:
        title_errors = [ln.strip() for ln in out.splitlines() if ln.strip().startswith("ERROR")] or [out]
        errors.append(f"PR title {title!r} breaks the commit pattern: " + "; ".join(title_errors))
    for sha in git(root, "rev-list", "--no-merges", "--reverse", f"{base}..{head}").split():
        message = git(root, "log", "-1", "--format=%B", sha)
        problems = check_message(root, message)
        short = sha[:7]
        if problems:
            subject = message.splitlines()[0] if message.strip() else ""
            errors.append(f"commit {short} {subject!r}: " + "; ".join(problems))
        else:
            print(f"pass   commit {short}")
    return errors


def code_gate(changed, gated, title):
    code = [p for p in changed if is_code(p)]
    if not code or gated:
        return []
    ctype = title_type(title)
    if ctype in NO_FEATURE_TYPES:
        print(f"pass   code changed with no feature folder: title type is `{ctype}`")
        return []
    return [f"this PR changes code ({', '.join(code[:5])}{', ...' if len(code) > 5 else ''}) but no gated "
            f"feature folder under {FEATURES_PREFIX} and its title type is `{ctype}`. Add the feature's "
            f"spec (checks.md, proofs.md, verification.md), or use the `docs` or `chore` type if the "
            f"change needs no spec. Folders in {EXEMPT_FILE} do not count."]


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--base", required=True, help="base commit of the PR")
    p.add_argument("--head", required=True, help="head commit of the PR (checked out)")
    p.add_argument("--title", required=True, help="PR title")
    p.add_argument("--author", default="", help="login of the PR author")
    p.add_argument("--root", default=".", help="repository root")
    args = p.parse_args(argv)
    root = os.path.abspath(args.root)

    errors = []
    try:
        changed = [ln for ln in git(root, "diff", "--name-only", f"{args.base}...{args.head}").splitlines() if ln]
        feature_errors, gated = feature_gate(root, changed)
        errors += feature_errors
        if args.author in BOT_AUTHORS:
            print(f"skip   commit and title checks: PR opened by {args.author}")
        else:
            errors += commit_gate(root, args.base, args.head, args.title)
        errors += code_gate(changed, gated, args.title)
    except GitError as e:
        errors.append(str(e))

    for e in errors:
        first, _, detail = e.partition("\n")
        print(f"::error::{first}")
        if detail:
            print(detail)
    print(f"spec-gates: {'FAIL' if errors else 'PASS'} ({len(errors)} error(s))")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
