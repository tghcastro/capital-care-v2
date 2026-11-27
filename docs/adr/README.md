# Architecture Decision Records

Each ADR records one significant decision: the context, the options considered, what was chosen and its trade-offs. ADRs are immutable: a changed decision gets a new ADR that supersedes the old one.

Smaller decisions are logged in [`.specs/STATE.md`](../../.specs/STATE.md) as they are made. The current stack-level rules live in [`docs/tech/definitions/`](../tech/definitions/).

| ADR | Title | Status | Date |
|---|---|---|---|
| [001](001-keep-business-rules-in-the-api.md) | Keep business rules in the API | Accepted | 2026-11-18 |
| [002](002-identity-as-a-separate-module.md) | Identity as a separate module | Accepted, not yet implemented | 2026-11-23 |
| [003](003-jwt-access-token-with-rotating-refresh-cookie.md) | JWT access token with a rotating refresh cookie | Accepted, not yet implemented | 2026-11-23 |
| [004](004-plan-auto-approval-policy.md) | Plan auto-approval policy | Proposed | 2026-11-26 |
| [005](005-agent-stop-and-notify-policy.md) | Agent stop and notify policy | Proposed | 2026-11-27 |

New ADRs: use the `create-adr` skill, MADR format, file name `NNN-kebab-case-title.md`.
