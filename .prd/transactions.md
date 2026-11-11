# Transactions

> Read this PRD and take the bet as settled. Do not re-derive it.
> Status: confirmed by tghcastro, 2026-11-11

## Situation

- Effort: in active construction
- Decision: committed by tghcastro, 2026-11-11, as the main goal of the project
- In flight: Categories and Accounts are already built and are the vocabulary a transaction points at; they stay as they are. The Web UI is a later round and stays out.
- At stake: cheap to undo. This is a personal tool with a single user, and the old tool stays available until cutover.

## Problem

Construction and absence. Transactions are the piece the project was started for. Without them, Categories and Accounts have nothing to describe, and the tracker cannot record or forecast money.

The owner cannot do this in their own product today. They track spending and forecasts in an existing third-party tool and plan to replace it. The stated reason is that it is too complex and has bad usability. No measurement of that exists. It is the owner's own judgment.

What the tool must keep doing is the monthly view of past and future entries, and marking an entry as paid (CONSOLIDATED).

A transaction records money already spent or received, or a forecast of a future payment or receipt. It has a date, a description, a Category, an Account, an amount and a Type (Receipt or Debit). It may also recur.

## Success

- Worked if: by a cutover month the owner chooses, the forecasts have been moved in by hand and one full month has run on this tool alone, consolidating entries here instead of in the old tool.
- Going wrong: within days of cutover the owner is still opening the old tool to look something up that this one cannot show.
- Review: end of the first full month after cutover - tghcastro.

## Boundary

In: transaction behaviour as seen by a programmatic caller, covering forecast and consolidated states, one-off, open-ended recurring and instalment entries, and the monthly view of past and future.

Out:
- Web UI - the next round.
- Importing history from the old tool - history is not needed, and the owner starts fresh from the cutover month.
- Reports, budgets and charts - not needed for parity with the old tool.

Unchanged: Categories and Accounts and how they are managed.

## Journey

| State | What should happen | Person sees |
|---|---|---|
| Create a one-off transaction | It is recorded with date, description, Category, Account, amount and Type (Receipt = money in, Debit = money out). It starts as a forecast until consolidated. | The entry in its month |
| Create an open-ended recurring transaction (Monthly or Annually) | It repeats with no end, for example condo fees, gym or insurance. Each occurrence appears in its own month. | An occurrence in every future month it applies to |
| Create an instalment transaction | The owner enters the current occurrence number (for example 97), the total number of occurrences (for example 504) and the value per instalment (for example 100,00). Entering one partway through the sequence is allowed. Occurrences stop after the last one. | Each occurrence in its month and the total (value x occurrences, for example 50.400,00) |
| Instalment occurrences | They are never consolidated automatically. The owner consolidates each one. | Unconsolidated occurrences stay as forecasts until the owner acts |
| Consolidate an entry | The owner marks an entry as paid or received. This is always a manual action. | The entry shown as CONSOLIDATED |
| Paid amount differs from forecast | The owner can enter the real amount when consolidating. It affects only that month. | The real amount in that month and the forecast unchanged in other months |
| Edit a forecast occurrence of a recurring entry | The change also applies to all future occurrences. | The new value in the following months |
| Edit a consolidated occurrence | The change applies to that occurrence only. | Other occurrences unchanged |
| Stop an open-ended recurring entry | Future occurrences are removed. Past occurrences remain exactly as they were. | Nothing from the stop point onward. History intact. |
| Forecast whose date has passed | It is never hidden. It stays visible as a forecast until the owner consolidates or deletes it. | The full month, day 1 to the last day, with consolidated and unconsolidated entries together |
| View a month | The owner can see any past or future month. | All entries of that month, whether forecast or consolidated |

## Open questions

1. Instalment total - default taken: shown as value x total occurrences, as the old tool does. Whether a remaining total is also wanted is not decided and does not block anything.
2. Cutover month - default taken: chosen by the owner when the tool is ready. The date is not fixed.
3. Behaviour when a Category or Account used by transactions is removed - not decided. It is specified in the Category and Account PRDs rather than here, and it blocks nothing until the feature spec.
