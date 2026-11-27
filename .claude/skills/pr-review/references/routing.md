# Routing: changed paths → checklists

Match every changed file against the table (first match per row, a file can match several rows).
Read only the checklists that matched, and only the definition sections each checklist points to.
This mirrors "What to Read, Depending on the Task" in [`docs/tech/AGENTS.md`](../../../../docs/tech/AGENTS.md).

| Changed path                                                                                    | Checklists                                                                                               |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/api/**`                                                                                   | [architecture](checklists/architecture.md), [api](checklists/api.md), [security](checklists/security.md) |
| `modules/*/src/**` (not tests)                                                                  | [architecture](checklists/architecture.md), [database](checklists/database.md)                           |
| `**/persistence/**`, `**/migrations/**`, `**/*.sql`, `**/schema*.ts`                            | [database](checklists/database.md)                                                                       |
| `**/auth/**`, `**/middleware/**`, anything handling tokens, passwords or the acting-user header | [security](checklists/security.md)                                                                       |
| `apps/web/**`                                                                                   | [web](checklists/web.md) (its UI items only for `.tsx` and `.css` files)                                 |
| `packages/shared/**`                                                                            | [architecture](checklists/architecture.md)                                                               |
| `**/__test__/**`, `**/*.test.*`, `apps/api/test/**`, `vitest.config.*`                          | [testing](checklists/testing.md)                                                                         |
| `.github/**`, `Dockerfile`, `docker-compose.yml`, `scripts/**`                                  | [ci-cd](checklists/ci-cd.md)                                                                             |
| `.githooks/**`, `.claude/settings.json`, `.github/PULL_REQUEST_TEMPLATE.md`                     | [git](checklists/git.md)                                                                                 |
| `package.json`, `pnpm-workspace.yaml`, `.npmrc`                                                 | [architecture](checklists/architecture.md), [security](checklists/security.md)                           |
| `**/*.md` (any)                                                                                 | [docs](checklists/docs.md)                                                                               |

Always, whatever matched: the PR title and commits follow [git](checklists/git.md) items 1–2.

Files not covered by any row get the general correctness and security pass only.
