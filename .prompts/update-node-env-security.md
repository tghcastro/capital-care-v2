# Update Node and PNPM

Task: update the pinned Node.js and pnpm versions in this repo, after checking that the versions I suggest below are really the right ones.

## Why
Node.js shipped five security releases for the 24.x line in 2026 (March, June, July, October and November 11). The repo currently pins Node 24.22.2, which has the October fixes but not the ones from November 11. Those November fixes cover HTTP/2, HTTPS and TLS issues, 7 of them rated high, and they landed in 24.22.3. I also plan to create a second repo (capital-care-tests) that copies the toolchain versions from this one, so whatever we pin here becomes the baseline for both.

### Suggested targets (treat these as hypotheses, not facts)
- Node.js: 24.22.3 or a newer 24.x patch if one exists.
- pnpm: keep 12.18.0 unless you find a good reason to move. 12.19.0 stops an offline install error from printing registry credentials, and 12.20.0 updates the bundled node-gyp so it no longer ships an undici version that scanners flag. Tell me whether these are worth taking.

**Step 1**: verify before changing anything
Do not trust my numbers. Check them yourself with web search and fetch, using primary sources:
- nodejs.org security release posts and the release schedule: what is the latest 24.x patch, is 24.x still LTS, and does the newest patch fix anything beyond 24.22.3?
- Docker Hub: do the images node:<version>-bookworm and node:<version>-bookworm-slim exist for the version you pick? Check how the Dockerfile references them today and whether a digest pin is in use.
- pnpm release notes and GitHub security advisories: any advisory or fix that affects 12.18.0, and what changed in 12.19.x and 12.20.x.
- Check that the new Node version satisfies the "engines" range in every package.json and that pnpm 12.18.0 (or your pick) works with it.
If anything disagrees with my suggestion, say so and pick the better version. Explain the choice in the PR description.

**Step 2**: find every place the versions live
Search the whole repo, do not rely on this list alone. Known places:
- .nvmrc
- Dockerfile (ARG NODE_VERSION, and the pinned pnpm install line)
- package.json (engines, packageManager) and the engines field in the other package.json files
- .github/workflows/ci-cd.yml (it reads .nvmrc, but confirm nothing else hardcodes a version)
- docker-compose.yml
- README.md and docs/tech/definitions/*.md where Node or pnpm versions are mentioned
- .github/dependabot.yml (only check whether Docker and Node updates are covered; do not change it unless something is clearly missing, and tell me if so)
If pnpm changes, regenerate pnpm-lock.yaml only as needed and keep the lockfile diff minimal.

**Step 3**: scope
- Change only the Node and pnpm versions and the text that mentions them.
- Do not upgrade any other dependency. The current package versions were reviewed with Snyk and Aikido and must stay as they are.
- Do not touch .pnpmfile.cjs, allowBuilds or minimumReleaseAge.

**Step 4**: validate
Run the same checks as CI, with the new Node version active:
- pnpm install --frozen-lockfile
- pnpm type-check
- pnpm lint
- pnpm build
- pnpm test
Then build the Docker image and start the dev profile (docker compose --profile dev up --build). Confirm that curl http://localhost:3000/health responds. Report which Node and pnpm versions the running container actually reports.

**Step 5**: deliver
Follow this repo's own rules (AGENTS.md and docs/tech/definitions/git.md) for branches, commits and PRs, and use the spec-driven workflow if it applies to a change this small. Never push to main. In the PR description, include:
- the final Node and pnpm versions chosen
- the sources you used to verify them, with links
- anything that differed from my suggestion
- the commands you ran and their results
At the end, show me a short summary of the final versions so I can copy them into the capital-care-tests repo.
