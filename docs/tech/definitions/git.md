# Git

Applies to humans and AI agents alike.

## Workflow

- `main` is always in a working state. Never commit directly to it.
- Work on short-lived branches created from `main`, and merge through a pull request (PR).
- PRs are merged with **squash merge**, so each PR becomes one commit on `main`. The PR title becomes the commit subject and must follow the [commit pattern](#commit-messages).

## Branch Names

- Format: `<type>/<short-description>` in lowercase kebab-case, e.g. `feat/transaction-categories`, `docs/git-definition`.
- `<type>` uses the same values as [commit types](#commit-messages).
- If the work comes from a Linear issue, include its code: `<type>/<ISSUE-CODE>-<short-description>`, e.g. `feat/CAP-8-child-categories`. Use this format instead of the branch name Linear suggests (`tghcastro/cap-8-...`); Linear still links the branch because it finds the code anywhere in the name.
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
- **Issue code:** when the work comes from a Linear issue, reference it in the footer, e.g. `Refs: CAP-8`. See [Task Tracker (Linear)](#task-tracker-linear).
- **Breaking changes:** add `!` after the type/scope (`feat(api)!: ...`) and a `BREAKING CHANGE:` footer.
- Keep each commit a single logical change.
- **CI check:** the `spec-gates` job checks every commit in a PR and the PR title against this pattern, and requires the `Refs: CAP-<n>` footer on every commit. See [ci-cd.md](./ci-cd.md#spec-gates).
- **AI-assisted commits:** commits authored with assistance from an AI tool must include an appropriate `Co-authored-by` trailer at the end of the message, identifying the actual tool or agent author. Do not use a provider-specific trailer when another tool authored the change. For example:

  ```
  Co-authored-by: <AI tool or agent name> <verified co-author email>
  ```

## Pull Requests

The template is [.github/PULL_REQUEST_TEMPLATE.md](../../../.github/PULL_REQUEST_TEMPLATE.md). Fill in every section.

- **Title:** follows the commit pattern above (it becomes the squash commit subject).
- **Issue:** the Linear issue with a closing keyword, e.g. `Closes CAP-8`, or `Refs CAP-8` when the PR is only part of the issue. Write "N/A" when there is no issue.
- **Summary:** one or two sentences on what the PR does and why.
- **Changes:** a bullet per file or area touched, specific enough that a reviewer doesn't need to open every file to know what changed.
- **Why:** the motivation or decision behind the change, if it isn't obvious from the Summary. Write "N/A" if nothing to add.
- **Type of change:** tick the matching box(es): Documentation / specs only, Feature, Bug fix, Refactor (no behavior change), Chore (tooling, config, dependencies). These map to the commit types `docs`, `feat`, `fix`, `refactor`, `chore`.
- **Verification:** a link to the feature's `.specs/features/<feature>/verification.md`. Write "N/A" for a `docs` or `chore` PR with no feature folder.
- **Testing:** how the change was verified (tests added or updated, manual steps). For documentation-only changes write "N/A — documentation-only change".
- Keep PRs small and focused on one concern.
- Delete the branch after merging.

## Task Tracker (Linear)

Work is tracked in Linear (team `capital-care`, issue key `CAP`). The Linear GitHub integration links branches, commits and PRs to issues by their code and updates the issue status:

| Where | Format | Effect in Linear |
|---|---|---|
| Branch name | `feat/CAP-8-child-categories` | Branch linked to the issue |
| Commit footer | `Refs: CAP-8` | Commit linked to the issue |
| PR description, Issue section | `Closes CAP-8` (also `Fixes`, `Resolves`) | Issue moves to In Progress when the PR opens and to Done when it merges |
| PR description, Issue section | `Refs CAP-8` (also `Part of`, `Related to`) | PR linked without closing the issue; use it when one issue needs several PRs |

- The PR title does not need the issue code. With squash merge it becomes the commit subject and must stay within the 72-character limit.
- One PR closes at most one issue. Split large issues into sub-issues in Linear rather than one large PR.
