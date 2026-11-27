# Code Review and Human Approval

How pull requests are reviewed before they merge: what the two checks do, how to read and clear
them, and how to turn the automated review off and on. Written for the owner.

Decision: [ADR-006](../adr/006-human-approval-and-review-gates.md). Pipeline details:
[ci-cd.md](../tech/definitions/ci-cd.md#code-review).

## How it works

Every pull request to `main` gets two checks, both required before a merge:

| Check            | What it does                                                                                                                                                           | Who decides                                                                                                                                          | Clears with                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `code-review`    | An AI reviewer (the [`pr-review`](../../.claude/skills/pr-review/SKILL.md) skill) reads the diff and checks it against `docs/tech/definitions/` and the accepted ADRs. | A model, held to strict rules                                                                                                                        | No open blocking finding, or the owner's `review-override` label |
| `human-approval` | A script looks for changes that always need a person (list below).                                                                                                     | Fixed rules in [`.github/human-approval.json`](../../.github/human-approval.json) and [`scripts/human_approval.py`](../../scripts/human_approval.py) | No protected change, or the owner's `owner-approved` label       |

Both fail closed: when they cannot decide, the PR waits for you. Agents never add or remove these
two labels. When a check waits for you, the agent stops, posts in Linear and `#capital-care`
(stop condition SC-9 in [workflow.md](../workflow.md#stop-conditions-and-owner-notification)), and
the PR waits.

### What needs your approval (`human-approval`)

- **Rules:** anything under `docs/tech/`, `docs/adr/`, `docs/workflow.md`, or any `AGENTS.md`.
- **Guardrails:** `.github/workflows/`, `.github/dependabot.yml`, `.github/spec-gates-exempt.txt`,
  `.github/human-approval.json`, the gate scripts in `scripts/`, `.claude/settings.json`,
  `.claude/skills/`, `.githooks/`.
- **Runtime and supply chain:** `.nvmrc`, `.npmrc`, `.pnpmfile.cjs`; a **new library** in any
  `package.json` (production or development; version bumps do not count); a changed
  `packageManager`; a new or changed override in `pnpm-workspace.yaml`.
- **Docker:** a changed `FROM` line or `NODE_VERSION` in the `Dockerfile`, or `image:` in a compose
  file.
- **Weakened quality gates:** a lowered coverage threshold, a lint rule turned off or an
  `eslint-disable` comment, a `.skip`/`.only` test.
- **One-way doors:** a migration with `DROP TABLE`, `DROP COLUMN` or `RENAME`.

The rules are read from `main`, so a PR cannot loosen the rules that judge it. Changing the list is
itself a protected change.

## Reading a review

The reviewer posts **inline comments** on the lines involved and one **summary comment** that it
updates on every run (findings table, the rules it read, the commit it reviewed).

- **`[blocking]`**: breaks a definition or an accepted ADR (the comment names the file and
  section), a security issue, or a bug with a concrete failing case. It fails the check.
- **`[suggestion]`**: anything else. It never blocks.
- **After a push**, the reviewer re-checks the open findings and reviews only the new commits.
  Fixed findings show as `resolved`. A blocking finding the reviewer forgets to mention stays open
  ("carried over"): it is never cleared by omission.

## Clearing a blocking finding

1. **Fix the code** and push. The re-review marks it resolved.
2. **Fix the rule**: if the definition is wrong or outdated, change it in the same PR. That makes
   the PR need your `owner-approved` label too.
3. **Override** (you only): when the finding is wrong, open the PR on GitHub, check the finding,
   and add the `review-override` label. The check re-runs in seconds and passes. The override
   covers that commit only: a new push removes the label.

## Approving a protected change

1. Open the failed `human-approval` check: its summary lists each rule, file and detail.
2. Review those changes. For a new library: is it maintained, is the license fine, is it needed,
   is it in the right section? For a base image: is the tag pinned and trusted?
3. Add the `owner-approved` label. A new push removes it, so approve after the last push.

## Turning the automated review off and on

The switch is the repository variable `AUTO_REVIEW`. It is a setting, not a file: no PR is needed,
and only a repository admin can change it.

**Turn it off**

1. On GitHub, open the repository → **Settings** → **Secrets and variables** → **Actions** →
   **Variables** tab.
2. Create the variable `AUTO_REVIEW` with the value `off` (or edit it to `off`).

**Turn it on**

1. Same page: set `AUTO_REVIEW` to `on`, or delete the variable (unset means on).
2. Push a commit, or close and reopen the PR, to start a review on PRs that are already open.

**While it is off**

- No AI review runs and no tokens are used.
- Every PR's `code-review` check fails with "Automated review is disabled: waiting for human
  review". Nothing merges, auto-merge included.
- You review the PR yourself and add `review-override` to let it merge.
- Agents stop at that point and notify you (SC-9). They resume when you have added the label, or
  after you turn the review back on and push.

**Do not disable the workflow in the Actions tab.** The required `code-review` check would then
never report. A missing check counts as failing and the ruleset has no bypass, so not even you
could merge. Use `AUTO_REVIEW` instead.

## Setup

One-time steps, done by the owner:

1. **Token:** run `claude setup-token` locally and save the result as the repository secret
   `CLAUDE_CODE_OAUTH_TOKEN` (Settings → Secrets and variables → Actions → Secrets). Reviews then
   use your Claude subscription limits, shared with your own sessions. Re-run it and update the
   secret when it expires.
2. **GitHub App:** the Claude GitHub App must be installed on the repository (it posts the inline
   comments).
3. **Labels:** create `owner-approved` and `review-override` (Issues → Labels).
4. **Required checks:** add `code-review` and `human-approval` to the `main` ruleset
   ([git.md](../tech/definitions/git.md#branch-protection)).

## Troubleshooting

| You see                                                                 | Meaning                                                                                    | What to do                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| "Automated review did not finish (no result): waiting for human review" | The review crashed, timed out, or hit the usage limit, or the token is missing or expired. | Check the run log. Fix the token if needed and push again, or review by hand and add `review-override`. |
| "No automated review has run on this pull request yet"                  | A label changed before the first review finished.                                          | Wait for the review run, or push.                                                                       |
| `human-approval` fails again after you approved                         | A new push removed `owner-approved`.                                                       | Review the new commits and add the label again.                                                         |
| `code-review` comments look generic on the PR that changes the reviewer | The reviewer always runs from `main`'s copy of the skill.                                  | Expected. The new version applies after merge.                                                          |

## Running the review locally

In Claude Code, run `/pr-review` on your branch (or `/pr-review 57` for a PR). It prints the
findings and the same JSON the check uses. It does not post comments or change labels.
