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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
