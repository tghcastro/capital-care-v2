# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | A calendar date (a day with no time of day) is stored as `YYYY-MM-DD` text, not as an epoch-millisecond timestamp. Timestamps stay for instants such as `createdAt` and `updatedAt` | a transaction date is a day, not a moment: as a timestamp the same bill could fall on another day in another time zone, and month-end rules would depend on whose clock is used. Approved with the Transactions plan ("Ok Agree"), after the explanation of this decision | active | 2026-11-12 |
