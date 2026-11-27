# ADR-005: Agent Stop and Notify Policy

- **Date**: 2026-11-27
- **Status**: Proposed (the owner confirms it by merging the pull request for [CAP-38](https://linear.app/tghcastro/issue/CAP-38/notify-the-owner-when-the-agent-is-blocked))
- **Deciders**: tghcastro (owner), with the Claude Code agent that wrote the proposal
- **Tags**: workflow, agents

## Context and Problem Statement

[ADR-004](004-plan-auto-approval-policy.md) says the agent "stops and notifies the owner" when a plan fails AP-1, but nothing defines how, or when else an agent must stop. An agent working alone can sit on a one-way door, a red test or a missing permission, or keep spending time and money on a fix that is not converging, and the owner finds out only from the weekly summary. The orchestrator skill (CAP-41) needs rules it can apply mechanically. When must an agent stop, how does the owner learn of it, and how much may a feature cost?

## Decision Drivers

- A blocked run must reach the owner within minutes, with the issue code and the decision needed.
- A run that hits a limit must stop, not continue.
- Limits must be adjustable per feature without editing the policy.
- Prefer documented rules over new infrastructure.
- The root rule against posting in `#capital-care` unasked should stay in force except for this case.

## Considered Options

- **A.** Stop and report only in the session; the owner is told when they next look (today).
- **B.** A fixed list of stop conditions; on a stop, a Linear comment and a `#capital-care` message from one template; configurable limits with project defaults.
- **C.** Build monitoring infrastructure (a service or scheduled job that watches runs and alerts).

## Decision Outcome

Chosen option: **B**, defined in [`docs/workflow.md`](../workflow.md#stop-conditions-and-owner-notification). Eight stop conditions (SC-1 to SC-8), three limits with defaults of 2 failed fix attempts per check, 1 hour wall time and $5 cost per feature, overridable per feature by a `**Limits**:` line in `plan.md` or `Limits:` in the issue's Agent notes. On a stop the agent posts a Linear comment and a Slack message from fixed templates, leaves its work in place and ends the run.

This is a deliberate exception to the root `AGENTS.md` rule "do not post in `#capital-care` unless the user asks": agents post there on their own for stops, and for nothing else.

### Positive Consequences

- The owner learns of a blocked run in minutes, from the place they already read.
- The rules are mechanical, so an orchestrator can follow them without judgment.
- Spend and runtime per feature are bounded, and the bound is the owner's to change.

### Negative Consequences

- The cost limit depends on the environment exposing cost; where it does not, only the other limits are enforced and the agent says so.
- Defaults may stop a legitimately large feature early; the owner raises the limit for it. This is the intended trade.
- An agent can still misjudge SC-1 or SC-2 and not stop; the verifier and the pull request review remain the second net.
- Slack and Linear are posted from an agent's credentials; a failure of one is covered only by posting to the other and reporting in the session.

## Pros and Cons of the Options

### A. Report in the session only

- ✅ Nothing to build or maintain
- ❌ Nobody is told; the problem this issue exists for

### B. Documented stop list, templates and limits ✅ Chosen

- ✅ Immediate, answerable notification with no new infrastructure
- ✅ Limits configurable per feature
- ❌ Relies on the agent applying the rules and measuring its own time and cost

### C. Monitoring infrastructure

- ✅ Catches runs that die without reporting
- ❌ Cost and upkeep out of proportion for a solo project; can be added later on top of B

## Links

- Policy: [`docs/workflow.md`](../workflow.md#stop-conditions-and-owner-notification)
- Builds on: [ADR-004](004-plan-auto-approval-policy.md) (AP-1 "stop and notify")
- Issue: [CAP-38](https://linear.app/tghcastro/issue/CAP-38/notify-the-owner-when-the-agent-is-blocked); blocks CAP-41 (orchestrator skill)
