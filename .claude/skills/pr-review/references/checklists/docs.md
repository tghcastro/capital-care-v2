# Checklist: docs

Sources: [root `AGENTS.md`](../../../../../AGENTS.md) conventions; the definition files a doc talks about.

1. **Contradictions.** A doc that states something different from `docs/tech/definitions/` or an accepted ADR without changing the definition too.
2. **Links.** Relative links to files or anchors that do not exist.
3. **Placement.** Documents outside `docs/` (except `README.md`, `AGENTS.md`, `.prd/`, `.specs/`); an `AGENTS.md` that describes files that are not in its folder.
4. **Language.** Not English; financial terms that differ from the standard nomenclature (Ledger, Transaction, Account).
5. **Leftovers.** TODOs, placeholders or template comments left in.
6. **ADRs** are immutable: an accepted ADR edited beyond its status line or links, instead of a new ADR that supersedes it. → [`docs/adr/README.md`](../../../../../docs/adr/README.md).
