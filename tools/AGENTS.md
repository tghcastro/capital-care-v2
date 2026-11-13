# AGENTS.md — tools

Developer tooling that is not part of the API runtime.

- `bruno/capital-care/` — Bruno API collection (plain-text `.bru` files) for the Category, Account and Transaction APIs, with `DEV` and `PRD` environments.
- Requests run in numbered order (`seq`); `Categories/Errors/`, `Accounts/Errors/` and `Transactions/Errors/` cover 4xx responses and clean up the data they create. `Accounts/Errors/12 Create beyond the limit` fills `otherUserId`'s accounts to the system account limit (5 in DEV, 99 in PRD) with a script, then deletes them. `Transactions/` creates its own category and account first, walks create, list, edit, settle, undo and stop for a monthly, a one-off and an instalment transaction, then deletes everything it created (the category and account last).
- Keep each request self-cleaning and its names unique per run, because PRD data persists.
- See [README.md](../README.md#api-collection-bruno) for how to open and run the collection.
