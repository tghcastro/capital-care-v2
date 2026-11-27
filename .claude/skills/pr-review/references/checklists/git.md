# Checklist: git and process

Source: [`docs/tech/definitions/git.md`](../../../../../docs/tech/definitions/git.md).

1. **PR title** follows Conventional Commits and fits 72 characters (it becomes the squash commit). Spec gates enforce the format; check the type matches the change (`feat` vs `chore`). → `#commit-messages`.
2. **PR description** fills every template section, with `Closes CAP-n` or `Refs CAP-n`. → `#pull-requests`, `#task-tracker-linear`.
3. **One concern.** Unrelated changes mixed into the PR. Suggestion. → `#pull-requests`.
4. **Hooks and settings.** `.githooks` weakened; `.claude/settings.json` deny rules removed or allow rules widened beyond routine commands. → `#local-git-hooks`, `#claude-code-settings`.
