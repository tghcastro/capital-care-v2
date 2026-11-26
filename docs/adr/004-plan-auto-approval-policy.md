# ADR-004: Plan Auto-Approval Policy

- **Date**: 2026-11-26
- **Status**: Proposed (the owner confirms it by merging the pull request for [CAP-31](https://linear.app/tghcastro/issue/CAP-31/plan-auto-approval-policy))
- **Deciders**: tghcastro (owner), with the Claude Code agent that wrote the proposal
- **Tags**: workflow, agents

## Context and Problem Statement

`tlc-spec-lean` builds only from a plan carrying an `**Approved**:` line in the owner's words (rule 11), and forbids `git push` and deploy without an explicit go-ahead (rule 8). An agent therefore cannot run from an approved PRD to a release without the owner in the middle. But plan review is also where the most valuable decisions happened so far (AD-006, withdrawing AD-007), so removing it has a cost. When may the agent approve a plan by itself, and when must it stop?

## Decision Drivers

- Keep the owner's review exactly where it has paid off: decisions that are expensive to undo and anything that departs from the PRD.
- An auto-approval must never be mistaken for the owner's words.
- The rule must be mechanical, so the agent cannot talk itself into it.
- Keep the skill close to upstream.

## Considered Options

- **A.** Keep owner approval of every plan (today).
- **B.** Auto-approve when the plan has no one-way door, no open question and no difference from the approved PRD; otherwise stop and notify the owner.
- **C.** Auto-approve every plan and review afterwards.

## Decision Outcome

Chosen option: **B**, as policy **AP-1** in [`docs/workflow.md`](../workflow.md#approval-policy). An auto-approval is written `**Approved**: <date> - policy: AP-1 - <why it applied>`. The skill accepts that form through a documented fork ([`FORK.md`](../../.claude/skills/tlc-spec-lean/FORK.md)) of one regex and two rule texts.

The owner's approval of the PRD also authorizes pushing the feature branch, opening the pull request and merging it once every required check and the verifier are green. A release, a deploy and any production data change still need an explicit go-ahead.

### Positive Consequences

- Small, well-understood features run from PRD to merge without waiting.
- Plans with one-way doors or deviations still stop at the owner.
- The record shows who approved: the owner (`user:`) or the policy (`policy:`).

### Negative Consequences

- A plan the agent judges free of one-way doors may hide one; the verifier and the pull request review are the second net.
- The skill is now a fork and needs its three edits re-applied on each upstream update.

## Pros and Cons of the Options

### A. Owner approves every plan

- ✅ Maximum control
- ❌ Blocks the agent on plans that need no decision

### B. Policy auto-approval ✅ Chosen

- ✅ Mechanical conditions, honest record
- ❌ Relies on the agent classifying one-way doors

### C. Always auto-approve

- ✅ Fastest
- ❌ Loses the review that produced the best decisions

## Links

- Policy: [`docs/workflow.md`](../workflow.md#approval-policy)
- Issue: [CAP-31](https://linear.app/tghcastro/issue/CAP-31/plan-auto-approval-policy); blocks CAP-41 (orchestrator skill)
- Skill rules: `.claude/skills/tlc-spec-lean/SKILL.md`, rules 8 and 11
