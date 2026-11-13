# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Allow combining marks in name character rules; letters of any language need them.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: account-management
- evidence: verification.md finding 1, C10 (validation)
- last seen: 2026-11-11T14:19:07Z

### L-002 - State the exact accepted format of an env var setting: whitespace, leading zeros, sign.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `config` · harmful: 0
- features: account-management
- evidence: verification.md finding 2, C23/C24 (config)
- last seen: 2026-11-11T14:19:07Z

### L-003 - Prove rename and uniqueness-exclusion rules against the real database, not only the in-memory mock.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: account-management
- evidence: verification.md finding 3, C6 (repo-layer)
- last seen: 2026-11-11T14:19:07Z

### L-004 - Test Unicode normalization and code-point length with decomposed and astral-plane names.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: account-management
- evidence: verification.md finding 4, C9/C13 (validation)
- last seen: 2026-11-11T14:19:07Z

### L-005 - Test a blank auth header as well as an absent one.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: account-management
- evidence: verification.md finding 5, C31 (routes)
- last seen: 2026-11-11T14:19:07Z

### L-006 - Assert each HTTP status and response envelope a check claims through the route, not only on the schema or the service
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: transactions
- evidence: .specs/features/transactions/verification.md C3 C4 C5 C6 C11 C26 C28 C29 (routes)
- last seen: 2026-11-12T12:31:33Z

### L-007 - Prove a sort tie-break with ids seeded in an order that disagrees with the expected order, not with random ids
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: transactions
- evidence: .specs/features/transactions/verification.md C13 (repo-layer)
- last seen: 2026-11-12T12:31:33Z

### L-008 - Prove user-scoping and stop rules against a real database with two users' data, not only on an in-memory mock that copies the rule
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: transactions
- evidence: .specs/features/transactions/verification.md C40 C51 (repo-layer)
- last seen: 2026-11-12T12:31:33Z

### L-009 - Do not use Date.UTC for calendar arithmetic: it maps the years 0 to 99 to 1900-1999
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `dates` · harmful: 0
- features: transactions
- evidence: .specs/features/transactions/verification.md finding Dates in years 0000-0099 (dates)
- last seen: 2026-11-12T12:31:33Z

### L-010 - State whether a digit-count limit applies to the written value or the stored value
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: transactions
- evidence: .specs/features/transactions/verification.md finding Amount with leading zeros (validation)
- last seen: 2026-11-12T12:31:33Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
