# ADR-006: Human Approval and Review Gates

- **Date**: 2026-11-27
- **Status**: Proposed (the owner confirms it by merging the pull request for [CAP-35](https://linear.app/tghcastro/issue/CAP-35/automated-code-review-on-pull-requests))
- **Deciders**: tghcastro (owner), with the Claude Code agent that wrote the proposal
- **Tags**: workflow, agents, ci

## Context and Problem Statement

The Verifier checks each acceptance criterion, but nobody reviews the code itself against `docs/tech/definitions/` and the ADRs. CAP-40 (auto-merge for agent PRs) will remove the owner from the merge, so the last check before an unattended merge must be strong. Some changes must never merge without a person looking at them: a change to the rules themselves (definitions, ADRs, agent instructions, CI guardrails), a new library, or a new base image. Agent PRs are opened under the owner's own GitHub account, so GitHub cannot tell the owner's approval from the agent's, and the owner cannot approve their own PR. How do we review every PR automatically, and guarantee a human for the changes that need one?

## Decision Drivers

- A blocking finding must stop the merge; nothing may pass because a review did not run.
- The changes that need a human are decided by rules, not by a model's judgment.
- A PR must not be able to weaken the gate that judges it.
- The owner can turn the automated review off without a code change, and agents then wait for a human.
- Cost stays bounded and predictable.

## Considered Options

- **A.** Owner reviews every PR by hand (today, before CAP-40).
- **B.** Two required checks: an LLM reviewer (`code-review`) for findings, and a deterministic script (`human-approval`) for changes that need a human; approval and override through owner-only labels.
- **C.** GitHub-native approvals: CODEOWNERS with required code-owner review.

## Decision Outcome

Chosen option: **B**, operated as described in [`docs/operations/code-review.md`](../operations/code-review.md):

- **`code-review`** runs the [`pr-review`](../../.claude/skills/pr-review/SKILL.md) skill with `claude-code-action`. A finding is blocking only when it cites a definition or an accepted ADR, or names a concrete failure. Open blocking findings fail the check. The repository variable `AUTO_REVIEW=off` skips the review; the check then waits for a human, as it does when a review does not finish.
- **`human-approval`** runs `scripts/human_approval.py` on `pull_request_target`, so the script and its rules (`.github/human-approval.json`) come from the base branch. A gated PR waits for the `owner-approved` label; a new push removes it.
- **Label policy:** an agent **never** adds or removes `owner-approved` or `review-override`. When either gate waits for the owner, the agent stops (SC-9 in [`docs/workflow.md`](../workflow.md#stop-conditions-and-owner-notification)) and notifies.

Option C needs a GitHub identity for the agent that differs from the owner's. It is the target: a follow-up issue gives the agent its own identity, and then CODEOWNERS replaces the label.

### Positive Consequences

- Every PR gets a review against the project's own rules, and the rules that matter most always reach a human.
- The human gate is mechanical and unit-tested; a model never decides whether the owner is needed.
- Turning the review off is a setting, and it fails closed: work waits instead of merging unreviewed.

### Negative Consequences

- The labels are enforced by policy, not by GitHub: an agent acting as the owner could add them. Claude Code settings deny shell commands that name them, but MCP label tools cannot be denied narrowly. This lasts until the agent has its own identity.
- LLM findings can be wrong; each wrong block costs the owner an override.
- Reviews use the owner's Claude subscription limits (`CLAUDE_CODE_OAUTH_TOKEN`), shared with their own sessions.
- Any push to a gated PR, including updating it from `main`, needs a fresh `owner-approved` label.

## Links

- [ADR-004](004-plan-auto-approval-policy.md) (what the PRD approval authorizes), [ADR-005](005-agent-stop-and-notify-policy.md) (stop and notify)
- [`docs/tech/definitions/ci-cd.md`](../tech/definitions/ci-cd.md#code-review), [`git.md`](../tech/definitions/git.md#branch-protection)
- Linear: CAP-35, CAP-40
