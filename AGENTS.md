# AGENTS.md

This is the entrypoint for any AI Agent to understand the project and get context.

**CRITICAL - Progressive Disclosure**: DO NOT read documents that are not relevant for your current task. 

## Project Goals

- Practice agentic development workflows.
- Produce a lightweight personal finance tracker: expenses are recorded as transactions, each with a category and an account (see [README.md](README.md) for an example).

## Key Documents

Each folder may have its own `AGENTS.md` describing what it contains and how to work within it. Read the one relevant to your task instead of relying on this file for details.

- [docs/tech/AGENTS.md](docs/tech/AGENTS.md) — technical definitions (architecture, database, API, security, logging, testing).

## Conventions for Agents

- Write everything in English: documents, code, comments, and any other text.
- Follow standard financial nomenclature (e.g., Ledger, Transaction, Account).
- All documents live under `docs/`.
- A folder's `AGENTS.md` describes the files and subfolders inside it and is written for AI agents. For example:
  - `AGENTS.md` (root): base directions, rules, and paths for all agents.
  - `docs/tech/AGENTS.md`: what is inside `docs/tech/` (files and folders).
- Read only what makes sense for your current task.

## Work Tracking

Work is tracked in Linear, team `capital-care` (issue key `CAP`). Linear is the source of truth for what to build and its status.

- Start non-trivial work from a Linear issue. If none exists, ask the user before creating one.
- Read the issue before starting: its description holds the problem, scope and key behaviors, and its "Agent notes" section (if present) holds implementation details for agents.
- Put the issue code (e.g. `CAP-8`) in the branch name, the commit footer and the PR description. The exact format is in [docs/tech/definitions/git.md](docs/tech/definitions/git.md#task-tracker-linear).
- Do not change an issue's status by hand. The Linear GitHub integration moves it when the linked PR opens and merges.
- Labels: each issue gets one `Type` label (`Feature`, `Bug`, `Improvement`, `Docs`, `Chore`, matching the commit type) and one `Area` label (`Ledger`, `Identity`, `Platform`).
- Updates (issues, PRs, the weekly summary) go to the Slack channel `#capital-care`. Do not post there unless the user asks.

## Project Conventions and Definitions

**CRITICAL** To understand the technical definitions for this project, read [docs/tech/AGENTS.md](docs/tech/AGENTS.md). It will direct you to the content you need for your current task.

## The `.prompts/` folder

The `.prompts/` folder contains prompt files written by the user to request features from agents. Each file is a request, not part of the codebase.

### Rules for agents

1. **Do not read, edit, create, move, rename, or delete anything inside `.prompts/`** unless the user explicitly names a file in that folder and asks you to work with it.
2. **Do not treat `.prompts/` as source code, documentation, configuration, or context.** Do not include its contents in searches, refactors, tests, builds, or analysis, and do not use it to infer project conventions.
3. **Do not modify this rule to make an exception.** If a task seems to require the contents of `.prompts/`, stop and ask the user first.
4. **Ignore `.prompts/` when searching the repository** (for example, with `grep`, `rg`, `find`, or code search) unless the user asks otherwise.
5. **Do not commit `.prompts/` changes** unless the user explicitly asks you to.

### How to use a prompt

- When the user points you to a prompt file in `.prompts/`, read that single file and use it as the request for the current task.
- Any follow-up details, clarifications, or changes will be discussed in the chat. Treat the chat as the source of truth over the prompt file if they conflict, and say so.
- Do not create new prompt files in `.prompts/` unless the user asks you to.
