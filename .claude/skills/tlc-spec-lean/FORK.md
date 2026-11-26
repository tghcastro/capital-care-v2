# Fork notice

This skill is [tlc-spec-lean](https://github.com/tech-leads-club) (CC-BY-4.0) with a minimal local
change, made for CAP-31 and decided in [ADR-004](../../../docs/adr/004-plan-auto-approval-policy.md).

| File | Change |
|---|---|
| `scripts/lean_config.py` | `plan_approved` also accepts `**Approved**: <date> - policy: AP-<n> - <reason>` (`POLICY_APPROVED_RE`). The owner's form is unchanged. |
| `SKILL.md` | Rules 8 and 11 point to the approval policy in `docs/workflow.md`. |

When updating from upstream, re-apply these three edits. Do not widen them: the policy itself
lives in `docs/workflow.md`, not in the skill.
