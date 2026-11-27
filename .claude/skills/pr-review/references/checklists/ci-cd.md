# Checklist: CI/CD

Source: [`docs/tech/definitions/ci-cd.md`](../../../../../docs/tech/definitions/ci-cd.md).

1. **Pinning.** A third-party action not pinned to a full commit SHA with the version in a trailing comment. → `#security-policy`.
2. **Permissions.** A workflow or job granting more than it needs; missing `contents: read` default. → `#security-policy`.
3. **Checkout credentials.** `actions/checkout` without `persist-credentials: false`. → `#security-policy`.
4. **Untrusted input.** `${{ github.event.* }}` text (titles, bodies, branch names) interpolated directly into `run:` scripts instead of passed through `env:`; `pull_request_target` workflows that check out or execute PR code.
5. **Time limits.** A new job without `timeout-minutes`, or the limits table in ci-cd.md not updated. → `#job-time-limits`.
6. **Gates.** A required check renamed, removed or made to pass on skip; publish running on pull requests. → `#pipeline`, `#triggers`, git.md `#branch-protection`.
7. **Images.** A new base image or tag not pinned to a version; publish pushing a rebuild instead of the smoke-tested image. → `#image-registry-and-tags`.
8. **Docs in step.** A workflow change without the matching update to ci-cd.md (and git.md for required checks).
