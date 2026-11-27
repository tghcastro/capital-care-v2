#!/usr/bin/env python3
"""
human_approval.py - the changes a pull request may not merge without the owner (CI job `human-approval`).

A PR is gated when it touches a protected path (listed in `.github/human-approval.json`) or makes a
protected change found in the diff:

  - new-dependency   a name added to a dependency section of any package.json, or packageManager changed
  - pnpm-override    an override added or changed in pnpm-workspace.yaml
  - base-image       a FROM line or ARG NODE_VERSION changed in a Dockerfile, or an image: in a compose file
  - coverage-lowered a coverage threshold lowered (or removed) in vitest.config.*
  - lint-disabled    a rule set to off in eslint.config.*, or an eslint-disable comment added anywhere
  - test-skipped     a .skip / .only / xit-style test added in a test file
  - destructive-migration  DROP TABLE, DROP COLUMN or RENAME added in a SQL migration

A gated PR passes only with the approval label (default `owner-approved`). On a `synchronize` event
the label does not count: approval always covers the latest commit, and the workflow removes it.

The rules file is read at the BASE commit, so a PR cannot relax the rules that judge it. The script
never runs code from the PR: it only reads blobs and diffs with git.

Usage:
  python3 scripts/human_approval.py --base <sha> --head <sha> [--labels a,b] [--event synchronize]

Standard library only. Exit codes: 0 not gated or approved, 1 gated and not approved (or error).
When GITHUB_OUTPUT is set it writes `gated` and `remove_label`; when GITHUB_STEP_SUMMARY is set it
writes a Markdown report.
"""

import argparse
import json
import os
import re
import subprocess
import sys

CONFIG_FILE = ".github/human-approval.json"
DEFAULT_LABEL = "owner-approved"
DEP_SECTIONS = ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")
THRESHOLD_RE = re.compile(r"\b(statements|branches|functions|lines)\s*:\s*(\d+(?:\.\d+)?)")
ESLINT_OFF_RE = re.compile(r"""(['"])off\1|:\s*0\s*[,}\]]|\[\s*0\s*[,\]]""")
ESLINT_DISABLE_RE = re.compile(r"eslint-disable")
TEST_SKIP_RE = re.compile(r"\b(?:it|test|describe|suite)\.(?:skip|only)\b|\bx(?:it|describe|test)\s*\(")
DESTRUCTIVE_SQL_RE = re.compile(r"\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|\bRENAME\b", re.IGNORECASE)
FROM_RE = re.compile(r"^\s*(FROM\s+.*|ARG\s+NODE_VERSION\b.*)$", re.IGNORECASE)
IMAGE_RE = re.compile(r"^\s*image\s*:\s*(.+?)\s*$")


class GitError(Exception):
    pass


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def git(root, *args):
    p = subprocess.run(["git", *args], cwd=root, capture_output=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise GitError(f"git {' '.join(args)}: {p.stderr.strip()}")
    return p.stdout


def show(root, rev, path):
    """A file's text at a revision, or '' when it does not exist there."""
    p = subprocess.run(["git", "show", f"{rev}:{path}"], cwd=root, capture_output=True, encoding="utf-8", errors="replace")
    return p.stdout if p.returncode == 0 else ""


def glob_to_re(glob):
    """`**/` any directories (or none), `**` anything, `*` and `?` within one path segment."""
    out, i = "", 0
    while i < len(glob):
        if glob.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif glob.startswith("**", i):
            out, i = out + ".*", i + 2
        elif glob[i] == "*":
            out, i = out + "[^/]*", i + 1
        elif glob[i] == "?":
            out, i = out + "[^/]", i + 1
        else:
            out, i = out + re.escape(glob[i]), i + 1
    return re.compile(f"^{out}$")


def load_config(root, base):
    text = show(root, base, CONFIG_FILE)
    if not text:
        # No rules on the base branch yet (the PR that adds them): use the working tree's copy.
        path = os.path.join(root, CONFIG_FILE)
        text = read_text(path) if os.path.exists(path) else "{}"
    return json.loads(text)


def basename(path):
    return path.rsplit("/", 1)[-1]


def added_lines(old, new):
    """Lines present in `new` more often than in `old` (a multiset difference, order-free)."""
    counts = {}
    for line in old.splitlines():
        counts[line] = counts.get(line, 0) + 1
    out = []
    for line in new.splitlines():
        if counts.get(line, 0) > 0:
            counts[line] -= 1
        else:
            out.append(line)
    return out


# --- content rules: each takes (path, old, new) and returns a list of details -------------------


def rule_new_dependency(path, old, new):
    if basename(path) != "package.json" or "node_modules/" in path:
        return []
    try:
        o = json.loads(old) if old.strip() else {}
        n = json.loads(new) if new.strip() else {}
    except json.JSONDecodeError as e:
        return [f"could not parse package.json ({e.msg}); review it by hand"]
    out = []
    for section in DEP_SECTIONS:
        added = sorted(set(n.get(section) or {}) - set(o.get(section) or {}))
        out += [f"{section}: added `{name}`" for name in added]
    if o.get("packageManager") != n.get("packageManager"):
        out.append(f"packageManager: `{o.get('packageManager')}` -> `{n.get('packageManager')}`")
    return out


def parse_overrides(text):
    """The `overrides:` block of pnpm-workspace.yaml as {key: value}. Top-level YAML only."""
    out, inside = {}, False
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            inside = line.split(":", 1)[0].strip() == "overrides"
            continue
        if inside:
            key, _, value = line.strip().rpartition(": ")
            if not key:
                key, value = line.strip().rstrip(":"), ""
            out[key.strip("'\"")] = value.strip()
    return out


def rule_pnpm_override(path, old, new):
    if path != "pnpm-workspace.yaml":
        return []
    o, n = parse_overrides(old), parse_overrides(new)
    return [f"override `{k}`: {o.get(k, '(new)')} -> {v}" for k, v in sorted(n.items()) if o.get(k) != v]


def rule_base_image(path, old, new):
    name = basename(path)
    if name == "Dockerfile" or name.endswith(".Dockerfile"):
        pattern = FROM_RE
    elif re.match(r"^(docker-)?compose[^/]*\.ya?ml$", name):
        pattern = IMAGE_RE
    else:
        return []
    o = [m.group(0).strip() for m in map(pattern.match, old.splitlines()) if m]
    n = [m.group(0).strip() for m in map(pattern.match, new.splitlines()) if m]
    if o == n:
        return []
    return [f"`{line}` removed" for line in o if line not in n] + [f"`{line}` added" for line in n if line not in o]


def rule_coverage_lowered(path, old, new):
    """Per metric, the threshold values sorted: any lower value, or a different count, is gated."""
    if not re.match(r"^vitest\.config\.[cm]?[jt]s$", basename(path)):
        return []
    o, n = THRESHOLD_RE.findall(old), THRESHOLD_RE.findall(new)
    out = []
    for metric in ("statements", "branches", "functions", "lines"):
        ov = sorted(float(v) for k, v in o if k == metric)
        nv = sorted(float(v) for k, v in n if k == metric)
        if len(ov) != len(nv):
            out.append(f"`{metric}` thresholds changed from {len(ov)} to {len(nv)} entries; review them by hand")
        elif any(b < a for a, b in zip(ov, nv)):
            out.append(f"`{metric}` lowered: {fmt(ov)} -> {fmt(nv)}")
    return out


def fmt(values):
    return ", ".join(f"{v:g}" for v in values)


def rule_lint_disabled(path, old, new):
    """ESLint only lints JavaScript and TypeScript, so only those files can disable it."""
    if not re.search(r"\.[cm]?[jt]sx?$", path):
        return []
    added = added_lines(old, new)
    out = [f"`{line.strip()}`" for line in added if ESLINT_DISABLE_RE.search(line)]
    if re.match(r"^eslint\.config\.[cm]?[jt]s$", basename(path)):
        out += [f"rule turned off: `{line.strip()}`" for line in added if ESLINT_OFF_RE.search(line)]
    return out


def is_test_file(path):
    return bool(re.search(r"\.(test|spec)\.[cm]?[jt]sx?$", path) or "/__test__/" in path or path.startswith(("test/", "apps/api/test/")))


def rule_test_skipped(path, old, new):
    if not is_test_file(path):
        return []
    return [f"`{line.strip()}`" for line in added_lines(old, new) if TEST_SKIP_RE.search(line)]


def rule_destructive_migration(path, old, new):
    if not (path.endswith(".sql") and "migrations/" in path):
        return []
    return [f"`{line.strip()}`" for line in added_lines(old, new) if DESTRUCTIVE_SQL_RE.search(line)]


CONTENT_RULES = (
    ("new-dependency", "New library or package manager change", rule_new_dependency),
    ("pnpm-override", "Dependency override added or changed", rule_pnpm_override),
    ("base-image", "Docker base image changed", rule_base_image),
    ("coverage-lowered", "Coverage threshold lowered", rule_coverage_lowered),
    ("lint-disabled", "Lint rule disabled", rule_lint_disabled),
    ("test-skipped", "Test skipped or focused", rule_test_skipped),
    ("destructive-migration", "Destructive database migration", rule_destructive_migration),
)


def evaluate(root, base, head):
    """Every trigger as (rule, reason, path, detail)."""
    config = load_config(root, base)
    merge_base = git(root, "merge-base", base, head).strip()
    changed = [p for p in git(root, "diff", "--name-only", "-z", f"{merge_base}...{head}").split("\0") if p]
    patterns = [(glob_to_re(p["glob"]), p["glob"], p.get("reason", "Protected path")) for p in config.get("paths", [])]
    triggers = []
    for path in changed:
        for regex, glob, reason in patterns:
            if regex.match(path):
                triggers.append(("path", reason, path, f"matches `{glob}`"))
                break
        old, new = show(root, merge_base, path), show(root, head, path)
        for rule, reason, fn in CONTENT_RULES:
            triggers += [(rule, reason, path, d) for d in fn(path, old, new)]
    return config, triggers


def write_outputs(gated, remove_label):
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"gated={'true' if gated else 'false'}\nremove_label={'true' if remove_label else 'false'}\n")


def escape_cell(text):
    return text.replace("|", "\\|")


def write_summary(triggers, label, verdict):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    lines = ["## Human approval", "", verdict, ""]
    if triggers:
        lines += ["| Rule | Why | File | Detail |", "|---|---|---|---|"]
        lines += [f"| {r} | {why} | `{p}` | {escape_cell(d)} |" for r, why, p, d in triggers]
        lines += ["", f"The owner reviews these changes and adds the `{label}` label. A new push removes it."]
    with open(path, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--base", required=True, help="base commit of the PR")
    p.add_argument("--head", required=True, help="head commit of the PR (fetched; need not be checked out)")
    p.add_argument("--labels", default="", help="comma-separated labels on the PR")
    p.add_argument("--event", default="", help="the pull_request event action, e.g. synchronize")
    p.add_argument("--root", default=".", help="repository root")
    args = p.parse_args(argv)
    root = os.path.abspath(args.root)

    try:
        config, triggers = evaluate(root, args.base, args.head)
    except (GitError, json.JSONDecodeError, OSError) as e:
        print(f"::error::human-approval could not evaluate the PR: {e}")
        write_outputs(True, False)
        return 1

    label = config.get("label", DEFAULT_LABEL)
    labels = {x.strip() for x in args.labels.split(",") if x.strip()}
    has_label = label in labels
    approved = has_label and args.event != "synchronize"
    gated = bool(triggers)
    write_outputs(gated, gated and has_label and args.event == "synchronize")

    for rule, why, path, detail in triggers:
        print(f"gated  [{rule}] {why}: {path}: {detail}")

    if not gated:
        verdict = "No protected change: no human approval needed."
        print(f"human-approval: PASS ({verdict})")
    elif approved:
        verdict = f"{len(triggers)} protected change(s), approved with the `{label}` label."
        print(f"human-approval: PASS ({verdict})")
    else:
        why = "a new push removes the approval" if has_label else f"add the `{label}` label after review"
        verdict = f"**Waiting for the owner:** {len(triggers)} protected change(s); {why}."
        print(f"::error::human-approval: waiting for the owner's approval ({len(triggers)} protected change(s)); {why}")
    write_summary(triggers, label, verdict)
    return 1 if gated and not approved else 0


if __name__ == "__main__":
    sys.exit(main())
