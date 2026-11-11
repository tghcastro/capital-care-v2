# AGENTS.md — tools

Developer tooling that is not part of the API runtime.

- `bruno/capital-care/` — Bruno API collection (plain-text `.bru` files) for the Category API, with `DEV` and `PRD` environments.
- Requests run in numbered order (`seq`); `Categories/Errors/` covers 4xx responses and cleans up the data it creates.
- Keep each request self-cleaning and its names unique per run, because PRD data persists.
- See [README.md](../README.md#api-collection-bruno) for how to open and run the collection.
