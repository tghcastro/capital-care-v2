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

### L-011 - Record a pipeline change the user asked for in chat as a plan criterion with a check before verifying, or the Verifier reports it as unplanned.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `.github/workflows` · harmful: 0
- features: security-headers-and-hardening
- evidence: plan.md AC 10 (.github/workflows)
- last seen: 2026-11-17T14:01:22Z

### L-012 - A check script that parses a config file by regex must also cover an added entry with no optional fields, and be mutation-tested with one.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `.specs checks` · harmful: 0
- features: security-headers-and-hardening
- evidence: C7 (.specs checks)
- last seen: 2026-11-17T14:01:22Z

### L-013 - Prove middleware order against each mount type (routes, errors, static) with a response from each, not one of them.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `apps/api/test` · harmful: 0
- features: security-headers-and-hardening
- evidence: C4 (apps/api/test)
- last seen: 2026-11-17T14:01:22Z

### L-014 - Express's default 404 handler replaces the Content-Security-Policy with default-src 'none'; assert that value, not the app's policy, on unknown routes.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `apps/api` · harmful: 0
- features: security-headers-and-hardening
- evidence: AC 2 (apps/api)
- last seen: 2026-11-17T14:01:22Z

### L-015 - When a rule rewrites a recurring schedule, give it an example on a stopped (finite) series as well as an open-ended one: a rebuilt schedule silently drops the old stop date.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `modules/ledger/transaction` · harmful: 0
- features: monthly-balance
- evidence: C27 / AC 12 (modules/ledger/transaction)
- last seen: 2026-11-18T18:41:19Z

### L-016 - When a rule trims only spaces, trim U+0020 explicitly; String.prototype.trim strips every Unicode whitespace and silently accepts characters the character rule refuses
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: child-categories
- evidence: verification.md finding 1 / C47 (validation)
- last seen: 2026-11-25T17:49:19Z

### L-017 - Prove a log or event rule also on the no-change case, asserting that nothing is written
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `observability` · harmful: 0
- features: child-categories
- evidence: verification.md finding 2 / C48 (observability)
- last seen: 2026-11-25T17:49:19Z

### L-018 - Give a service branch that expands its input through another service a unit test whose stub returns extra values, not an identity stub
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `service-layer` · harmful: 0
- features: child-categories
- evidence: verification.md finding 3 / C49 (service-layer)
- last seen: 2026-11-25T17:49:19Z

### L-019 - Read a gate's allow-list or exemption file at the PR base commit, never at the head the PR controls
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ci` · harmful: 0
- features: ci-spec-gates
- evidence: scripts/spec_gates.py read_exempt (verification.md finding 1) (ci)
- last seen: 2026-11-26T17:19:55Z

### L-020 - Read git path lists with -z so non-ASCII paths are not quoted and misclassified
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ci` · harmful: 0
- features: ci-spec-gates
- evidence: scripts/spec_gates.py main git diff (verification.md finding 2) (ci)
- last seen: 2026-11-26T17:19:55Z

### L-021 - Decide how a gate treats a feature folder that holds only a plan before writing its checks
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `ci` · harmful: 0
- features: ci-spec-gates
- evidence: verification.md finding 3 (ci)
- last seen: 2026-11-26T17:19:55Z

### L-022 - When a CI rule tightens a documented convention, update every sentence that states the old rule
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `docs` · harmful: 0
- features: ci-spec-gates
- evidence: docs/tech/definitions/git.md:39 (verification.md finding 4) (docs)
- last seen: 2026-11-26T17:19:55Z

### L-023 - After an irreversible step succeeds (file replaced, backup written), later cleanup must not be reported as failure of that step: return it as a warning and test the failure after the commit point.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `operations` · harmful: 0
- features: database-backup-and-restore
- evidence: verification.md finding 1-2, C21 (operations)
- last seen: 2026-11-27T22:00:05Z

### L-024 - A script that stops a service must restart it on SIGHUP/INT/TERM too; prove it with a test that signals the script mid-run.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `scripts` · harmful: 0
- features: database-backup-and-restore
- evidence: plan door 3, C23 (scripts)
- last seen: 2026-11-27T22:00:05Z

### L-025 - A permission-denied example cannot be proven by integration tests that may run as root; name it as a unit-level fake failure in the plan instead.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `operations` · harmful: 0
- features: database-backup-and-restore
- evidence: plan AC 7, C20 (operations)
- last seen: 2026-11-27T22:00:05Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
