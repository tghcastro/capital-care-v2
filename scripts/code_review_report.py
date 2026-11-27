#!/usr/bin/env python3
"""
code_review_report.py - the verdict of the `code-review` check and its summary comment.

The `pr-review` skill (run by claude-code-action) returns its findings as JSON. This script turns
them into the one summary comment on the PR and decides whether the check passes. It never trusts a
missing result: a review that did not finish, or an automated review that is turned off, waits for
a human, who clears it with the override label after reviewing the PR.

Subcommands:
  state   --comment-file F --out F       read the previous summary comment, write its state JSON
                                         (prints `last_sha=<sha>` and `last_status=<status>`)
  report  --mode M --labels L --event E --head-sha S --body-out F
          [--output-file F] [--previous-file F]
                                         write the new comment body; exit 0 pass, 1 fail

Modes: review (a fresh result in --output-file), disabled (AUTO_REVIEW=off), labels (only labels
changed: re-judge the previous state), dependabot (pass without review).

On a `synchronize` event the override label does not count: an override covers one commit only.
Standard library only.
"""

import argparse
import base64
import json
import os
import re
import sys

MARKER = "pr-review:v1"
MARKER_RE = re.compile(r"<!-- " + re.escape(MARKER) + r" ([A-Za-z0-9+/=]+) -->")
OVERRIDE_LABEL = "review-override"
HOWTO = "docs/operations/code-review.md"


def read_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def encode_state(state):
    return base64.b64encode(json.dumps(state, sort_keys=True).encode()).decode()


def extract_state(comment_body):
    """The state embedded in a previous summary comment, or None."""
    m = MARKER_RE.search(comment_body or "")
    if not m:
        return None
    try:
        return json.loads(base64.b64decode(m.group(1)))
    except (ValueError, json.JSONDecodeError):
        return None


def load_json(path):
    if not path or not os.path.exists(path):
        return None
    text = read_text(path).strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def valid_result(result):
    return isinstance(result, dict) and isinstance(result.get("findings"), list)


def open_blocking(findings):
    return [f for f in findings if f.get("severity") == "blocking" and f.get("status", "open") == "open"]


def carry_forward(previous, findings):
    """Previous open blocking findings the new result left out stay open: dropping one silently must not pass."""
    if not previous:
        return findings
    ids = {f.get("id") for f in findings}
    kept = [dict(f, carried=True) for f in open_blocking(previous.get("findings", [])) if f.get("id") not in ids]
    return findings + kept


def build_state(mode, result, previous, head_sha):
    if mode == "disabled":
        return {"status": "disabled", "reviewed_sha": head_sha, "findings": [], "rules_read": []}
    if mode == "dependabot":
        return {"status": "skipped", "reviewed_sha": head_sha, "findings": [], "rules_read": []}
    if mode == "labels":
        return previous or {"status": "none", "reviewed_sha": "", "findings": [], "rules_read": []}
    if not valid_result(result):
        return {"status": "failed", "reviewed_sha": head_sha, "findings": [], "rules_read": []}
    findings = carry_forward(previous if (previous or {}).get("status") == "reviewed" else None, result["findings"])
    return {
        "status": "reviewed",
        "reviewed_sha": result.get("reviewed_sha") or head_sha,
        "review_mode": result.get("mode", "full"),
        "findings": findings,
        "rules_read": result.get("rules_read", []),
    }


def verdict(state, overridden):
    """(passes, headline) for a state."""
    status = state.get("status")
    if status == "skipped":
        return True, "Skipped: Dependabot pull request."
    if status == "reviewed":
        blocking = open_blocking(state.get("findings", []))
        if not blocking:
            return True, "No blocking findings."
        if overridden:
            return True, f"{len(blocking)} blocking finding(s) open, overridden by the owner (`{OVERRIDE_LABEL}`)."
        return False, f"{len(blocking)} blocking finding(s) open."
    reason = {
        "disabled": "Automated review is disabled (`AUTO_REVIEW=off`)",
        "failed": "Automated review did not finish (no result)",
        "none": "No automated review has run on this pull request yet",
    }.get(status, "Automated review state is unknown")
    if overridden:
        return True, f"{reason}. Reviewed by the owner (`{OVERRIDE_LABEL}`)."
    return False, f"{reason}: waiting for human review."


def cell(text):
    return str(text or "").replace("|", "\\|").replace("\n", " ")


def render(state, passes, headline):
    icon = "✅" if passes else "⛔"
    lines = ["## Automated code review", "", f"{icon} **{headline}**", ""]
    if state.get("status") == "reviewed":
        sha = state.get("reviewed_sha", "")[:7]
        lines.append(f"Reviewed commit `{sha}` ({state.get('review_mode', 'full')} review).")
        if state.get("rules_read"):
            lines.append("Rules read: " + ", ".join(f"`{r}`" for r in state["rules_read"]) + ".")
        findings = state.get("findings", [])
        if findings:
            order = {"blocking": 0, "suggestion": 1}
            findings = sorted(findings, key=lambda f: (f.get("status") != "open", order.get(f.get("severity"), 2)))
            lines += ["", "| # | Severity | Status | Where | Rule | Finding |", "|---|---|---|---|---|---|"]
            for f in findings:
                where = f"`{f.get('file', '')}:{f.get('line', '')}`" if f.get("file") else ""
                status = f.get("status", "open") + (" (carried over)" if f.get("carried") else "")
                lines.append(
                    f"| {cell(f.get('id'))} | {cell(f.get('severity'))} | {cell(status)} | {where} "
                    f"| {cell(f.get('rule_ref'))} | {cell(f.get('summary'))} |"
                )
    if not passes:
        lines += [
            "",
            "To clear it: fix the code and push, or (owner only) review the pull request and add the "
            f"`{OVERRIDE_LABEL}` label. A new push removes the label. See [`{HOWTO}`]({HOWTO}).",
        ]
    lines += ["", f"<!-- {MARKER} {encode_state(state)} -->"]
    return "\n".join(lines) + "\n"


def cmd_state(args):
    body = read_text(args.comment_file) if os.path.exists(args.comment_file) else ""
    state = extract_state(body) or {}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(state, f)
    print(f"last_sha={state.get('reviewed_sha', '')}")
    print(f"last_status={state.get('status', '')}")
    return 0


def cmd_report(args):
    labels = {x.strip() for x in args.labels.split(",") if x.strip()}
    overridden = OVERRIDE_LABEL in labels and args.event != "synchronize"
    previous = load_json(args.previous_file) or None
    state = build_state(args.mode, load_json(args.output_file), previous, args.head_sha)
    passes, headline = verdict(state, overridden)
    with open(args.body_out, "w", encoding="utf-8") as f:
        f.write(render(state, passes, headline))
    print(f"code-review: {'PASS' if passes else 'FAIL'} ({headline})")
    if not passes:
        print(f"::error::code-review: {headline}")
    return 0 if passes else 1


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("state")
    s.add_argument("--comment-file", required=True)
    s.add_argument("--out", required=True)
    r = sub.add_parser("report")
    r.add_argument("--mode", required=True, choices=["review", "disabled", "labels", "dependabot"])
    r.add_argument("--labels", default="")
    r.add_argument("--event", default="")
    r.add_argument("--head-sha", default="")
    r.add_argument("--output-file", default="")
    r.add_argument("--previous-file", default="")
    r.add_argument("--body-out", required=True)
    args = p.parse_args(argv)
    return cmd_state(args) if args.cmd == "state" else cmd_report(args)


if __name__ == "__main__":
    sys.exit(main())
