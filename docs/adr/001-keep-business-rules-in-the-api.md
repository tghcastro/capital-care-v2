# ADR-001: Keep Business Rules in the API

- **Date**: 2026-11-18
- **Status**: Accepted
- **Deciders**: tghcastro (owner), with the Claude Code agent that wrote the Monthly Balance plan
- **Tags**: architecture, api, web
- **Origin**: decision AD-006 in [`.specs/STATE.md`](../../.specs/STATE.md); supersedes the client-side approach AD-003

## Context and Problem Statement

The first transactions page computed the running balance and monthly totals in the browser (AD-003), because no API returned a balance. The [Monthly Balance PRD](../../.prd/monthly-balance.md) added rules that are harder: balances carry over between months, and with a category filter the running balance restarts at 0.00 and the totals are hidden. The first draft of the plan kept the carry-over and filter rules in the web client and had the API return only opening balances per account.

## Decision Drivers

- One place to test the rules that decide what money the owner sees.
- The web client must stay a thin display layer (`apps/web` only talks to the API over HTTP).
- A future client (mobile, CLI, export) must not re-implement the rules.
- A month view must not need an unbounded number of requests.

## Considered Options

- **A.** The API computes balances, totals and filtering. The web sends the month and filters and displays the result.
- **B.** The API returns opening balances per account on the month response, and the web sums them and applies the category rule.
- **C.** The web walks earlier months and adds them up itself.

## Decision Outcome

Chosen option: **A**, because the owner, reviewing the plan, ruled that *"all business logic should be kept on API. Front-end should only request month and lists to display data."* It is the only option that keeps every rule in `modules/ledger`, where unit and API component tests reach it.

The API gained `GET /transactions/balance?month=YYYY-MM[&category=..][&account=..]`, and `GET /transactions` takes the same filters.

### Positive Consequences

- The balance, carry-over, filter and totals rules are tested once, in `TransactionService`.
- The web client has no financial logic, so another client can reuse the API as it is.

### Negative Consequences

- Every filter change is a round trip to the API instead of an in-memory filter.
- Web tests and criteria written for client-side filtering had to be rewritten.
- The API surface grows with each view-specific need (a new route for balances).

## Pros and Cons of the Options

### A. Rules in the API ✅ Chosen

- ✅ One source of truth, tested at the service and route level
- ✅ Thin, replaceable client
- ❌ More requests, one more route

### B. Opening balances, web sums

- ✅ Small API change
- ❌ Carry-over, category rule and totals stay in the browser

### C. Web walks earlier months

- ✅ No API change
- ❌ Unbounded requests, and the rule lives in the client

## Links

- PRD: [`.prd/monthly-balance.md`](../../.prd/monthly-balance.md)
- Plan: [`.specs/features/monthly-balance/plan.md`](../../.specs/features/monthly-balance/plan.md), one-way door 1
- Delivered in [PR #31](https://github.com/tghcastro/capital-care-v2/pull/31)
