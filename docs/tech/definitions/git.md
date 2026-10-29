# Git

Applies to humans and AI agents alike.

## Workflow

- `main` is always in a working state. Never commit directly to it.
- Work on short-lived branches created from `main`, and merge through a pull request (PR).
- PRs are merged with **squash merge**, so each PR becomes one commit on `main`. The PR title becomes the commit subject and must follow the [commit pattern](#commit-messages).

## Branch Names

- Format: `<type>/<short-description>` in lowercase kebab-case, e.g. `feat/transaction-categories`, `docs/git-definition`.
- `<type>` uses the same values as [commit types](#commit-messages).
- If the work comes from a task tracker (Jira, Linear), include the task code: `<type>/<TASK-CODE>-<short-description>`, e.g. `feat/CC-42-transaction-categories`.
- The name must describe the change. Avoid names like `fix`, `test`, `my-branch`.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

- **Types:**
  - `feat` — new functionality
  - `fix` — bug fix
  - `docs` — documentation only
  - `refactor` — code change with no behavior change
  - `test` — adding or updating tests
  - `chore` — tooling, config, dependencies
- **Subject:** imperative mood ("add", not "added"), lowercase, no trailing period, 72 characters or fewer.
- **Body (optional):** explain *why*, not *what*; wrap at 72 characters.
- **Task code:** when applicable, reference it in the footer, e.g. `Refs: CC-42`.
- **Breaking changes:** add `!` after the type/scope (`feat(api)!: ...`) and a `BREAKING CHANGE:` footer.
- Keep each commit a single logical change.
- **AI-assisted commits:** commits authored with assistance from an AI tool must include an appropriate `Co-authored-by` trailer at the end of the message, identifying the actual tool or agent author. Do not use a provider-specific trailer when another tool authored the change. For example:

  ```
  Co-authored-by: <AI tool or agent name> <verified co-author email>
  ```

## Pull Requests

The template is [.github/PULL_REQUEST_TEMPLATE.md](../../../.github/PULL_REQUEST_TEMPLATE.md). Fill in every section.

- **Title:** follows the commit pattern above (it becomes the squash commit subject).
- **Summary:** one or two sentences on what the PR does and why.
- **Changes:** a bullet per file or area touched, specific enough that a reviewer doesn't need to open every file to know what changed.
- **Why:** the motivation or decision behind the change, if it isn't obvious from the Summary. Write "N/A" if nothing to add.
- **Type of change:** tick the matching box(es): Documentation / specs only, Feature, Bug fix, Refactor (no behavior change), Chore (tooling, config, dependencies). These map to the commit types `docs`, `feat`, `fix`, `refactor`, `chore`.
- **Testing:** how the change was verified (tests added or updated, manual steps). For documentation-only changes write "N/A — documentation-only change".
- Keep PRs small and focused on one concern.
- Delete the branch after merging.
