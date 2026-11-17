# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | A calendar date (a day with no time of day) is stored as `YYYY-MM-DD` text, not as an epoch-millisecond timestamp. Timestamps stay for instants such as `createdAt` and `updatedAt` | a transaction date is a day, not a moment: as a timestamp the same bill could fall on another day in another time zone, and month-end rules would depend on whose clock is used. Approved with the Transactions plan ("Ok Agree"), after the explanation of this decision | active | 2026-11-12 |
| AD-002 | Categories are a flat list in the web layer; the category tree (children expanded by default) waits until the Category API has a parent field | the Category API has no parent field and the web layer may not add APIs. Question: "The Category API is flat... How should the 'first level of child categories expanded by default' requirement be handled?" Option chosen: "Flat list now (Recommended)" | active | 2026-11-17 |
| AD-003 | The web page computes the running balance and monthly totals itself: the opening balance of the selected month is 0.00, every occurrence (settled or forecast) counts, and with a category or account filter active they cover only the visible rows | no API returns a balance. Questions: "What is the opening balance...?" Option chosen: "0.00 at month start, all occurrences (Recommended)"; "should the running balance and monthly summary reflect only the filtered transactions or the whole month?" Option chosen: "Filtered transactions only" | active | 2026-11-17 |
