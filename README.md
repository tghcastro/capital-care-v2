# Capital Care

A lightweight personal finance tracker for recording expenses (transactions), each classified by a category and paid from an account.

Example transaction:

| Date | Description | Amount | Category | Account |
|------|-------------|--------|----------|---------|
| 29/Oct/2026 | Best Market - Some groceries | 20.00 | Groceries | Credit Card |

## About This Project

This is a learning project: the real goal is practicing agentic development workflows, with the finance tracker itself as the vehicle.

---

## Getting Started

### Prerequisites

- **Node.js**: 24.x (LTS) — check with `node --version`
- **pnpm**: 12.18.0+ — install with `npm install -g pnpm`

### Setup

1. **Install dependencies** (one time):
   ```bash
   cd /Users/castrth/workspace/capital-care
   pnpm install
   ```
   
   If you hit a build approval prompt for `better-sqlite3`, approve it when asked.

2. **Build the project**:
   ```bash
   npm run build
   ```
   
   This compiles TypeScript in all packages. Output goes to `dist/` directories.

---

## Running the API

### Start the server

```bash
npm run dev
```

The API starts on `http://localhost:3000`.

Health check: `curl http://localhost:3000/health`

---

## Running with Docker

The API runs in a container with two Compose profiles. Both run pending migrations before the server starts.

| Profile | Database | Command |
|---------|----------|---------|
| DEV (local tests) | In memory (`tmpfs`). Discarded when the container stops or restarts. | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` |
| PRD | Named volume `capital-care-data`. Survives restarts. | `docker compose -f docker-compose.yml -f docker-compose.prd.yml up -d --build` |

- The API listens on `http://localhost:3000` (override with `API_PORT`). Health check: `curl http://localhost:3000/health`
- Stop DEV with `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`. No data is kept.
- Delete PRD data with `docker compose -f docker-compose.yml -f docker-compose.prd.yml down -v`. This is irreversible.
- PRD backups are not configured yet (see [database.md](docs/tech/definitions/database.md)).

### Published images

Every push to `main` and every release tag is published to GitHub Container Registry. Pull and run a published image without building it locally:

```bash
docker pull ghcr.io/tghcastro/capital-care-v2:latest   # most recent build of main
docker pull ghcr.io/tghcastro/capital-care-v2:0.1.0    # a release (see below)

docker run -p 3000:3000 ghcr.io/tghcastro/capital-care-v2:latest
curl http://localhost:3000/health
```

- The database lives in `/app/data` inside the container. Mount a volume there to keep data after the container is removed, for example `-v capital-care-data:/app/data`.
- Pipeline details, tags and the release rules are in [ci-cd.md](docs/tech/definitions/ci-cd.md).

### Releasing

A release is a version tag on a commit that is already on `main`. Use the release script, which checks out the latest `main`, tags it and pushes the tag:

```bash
scripts/release.sh 0.1.0
```

It refuses to run with uncommitted changes, an invalid `MAJOR.MINOR.PATCH` version, or a tag that already exists. The manual equivalent is:

```bash
git switch main && git pull
git tag v0.1.0
git push origin v0.1.0
```

The pipeline publishes `0.1.0`, `0.1` and `sha-<short-sha>`. It does not move `latest`. A tag whose commit is not on `main` fails before anything is published.

### Database migrations

```bash
pnpm build          # compiles TypeScript and copies SQL migrations into dist/
pnpm db:migrate     # applies pending migrations to DB_PATH (default ./data/capital-care.db)
pnpm db:generate    # after changing a schema: generates a new SQL migration
```

---

## Testing Manually

### Category Management Endpoints

The category feature is fully implemented. Test it with `curl` or Postman:

#### 1. **Create a category**

```bash
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "name": "Groceries",
    "description": "Food and household items"
  }'
```

**Expected response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "name": "Groceries",
  "description": "Food and household items",
  "createdAt": "2026-11-06T13:45:30.123Z",
  "updatedAt": "2026-11-06T13:45:30.123Z"
}
```

#### 2. **List all categories**

```bash
curl http://localhost:3000/categories \
  -H "X-User-Id: user-123"
```

**Expected response** (200 OK):
```json
{
  "categories": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-123",
      "name": "Groceries",
      "description": "Food and household items",
      "createdAt": "2026-11-06T13:45:30.123Z",
      "updatedAt": "2026-11-06T13:45:30.123Z"
    }
  ]
}
```

#### 3. **Sort categories descending**

```bash
curl http://localhost:3000/categories?sort=-name \
  -H "X-User-Id: user-123"
```

#### 4. **Fetch a single category**

```bash
curl http://localhost:3000/categories/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-User-Id: user-123"
```

**Expected response** (200 OK): Category object

#### 5. **Update a category**

```bash
curl -X PATCH http://localhost:3000/categories/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "description": "Food, household items, and groceries"
  }'
```

**Expected response** (200 OK): Updated category

#### 6. **Delete a category**

```bash
curl -X DELETE http://localhost:3000/categories/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-User-Id: user-123"
```

**Expected response** (204 No Content): Empty body, no JSON

---

### Test Scenarios

#### ✅ Create category without name → 400 ValidationError

```bash
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{"description": "oops"}'
```

Response: `400` with `{"type":"ValidationError","detail":"name is required"}`

#### ✅ Create duplicate name for same user → 409 ConflictError

```bash
# Create first
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{"name": "Groceries"}'

# Try duplicate
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{"name": "Groceries"}'
```

Response: `409` with `{"type":"ConflictError","detail":"..."}`

#### ✅ Different user can create same name

```bash
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-456" \
  -d '{"name": "Groceries"}'
```

Response: `201` — succeeds (different user)

#### ✅ Missing X-User-Id header → 401 UnauthorizedError

```bash
curl http://localhost:3000/categories
```

Response: `401` with `{"type":"UnauthorizedError","detail":"User ID required"}`

#### ✅ Fetch category owned by different user → 404 NotFoundError

```bash
# Create as user-123
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{"name": "MyCategory"}' 
# Returns id: "550e8400-e29b-41d4-a716-446655440000"

# Try to fetch as user-456
curl http://localhost:3000/categories/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-User-Id: user-456"
```

Response: `404` (not 403 — ownership check returns "not found" per design)

---

## Running Tests

### Unit tests (if pnpm cache is healthy)

```bash
npm test
```

Tests are located in `modules/ledger/src/category/__test__/` and cover:
- Create (7 tests)
- Uniqueness (1 test)
- List & sort (3 tests)
- Update (4 tests)
- Delete (2 tests)

### Build & type check

```bash
npm run build        # TypeScript compilation
npm run type-check   # Type checking only (no emit)
npm run lint         # ESLint (if setup complete)
```

---

## Project Structure

```
capital-care/
  apps/api/                    # Express API app
    src/app.ts                 # Composition root, mounts routers
  modules/ledger/              # Category, transaction, account logic
    src/
      category/                # Category aggregate (C R U D)
        category.controller.ts # HTTP handlers
        category.service.ts    # Business logic
        category.repository.ts # DB access
        category.entity.ts     # Drizzle table
        __test__/              # Unit tests
      shared/                  # DB client, error types
  packages/shared/             # Shared types, Zod schemas (future)
  docs/tech/definitions/       # Architecture decisions (read for context)
```

---

## Contributing / AI Agent Context

If you're an AI agent working in this repo, start at [AGENTS.md](AGENTS.md) instead of this file.
