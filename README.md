# Brimble — Fullstack / Infra Engineer Take-Home

A one-page deployment pipeline that accepts a Git URL, builds it into a container image with Railpack, runs it via Docker, and routes traffic through Caddy — all driven from a single UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Vite + TanStack Query)                               │
│  localhost:5173                                                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ Deploy Form   │  │ Deployment List  │  │ Log Viewer (SSE)  │  │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬──────────┘  │
│         │                   │                      │             │
└─────────┼───────────────────┼──────────────────────┼─────────────┘
          │                   │                      │
          ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend API (Bun + Express + SQLite)                           │
│  localhost:8080                                                  │
│                                                                  │
│  POST /api/deployments        → Create deployment, start pipeline│
│  GET  /api/deployments        → List all deployments             │
│  GET  /api/deployments/:id    → Get single deployment            │
│  GET  /api/deployments/:id/logs → SSE log stream                 │
│  DELETE /api/deployments/:id  → Stop container, cleanup routes   │
│                                                                  │
│  Pipeline (async after 201 response):                            │
│  1. git clone → /tmp/{id}                                        │
│  2. Railpack build → Docker image (deploy-{id})                  │
│  3. docker run → container on next available port                │
│  4. Caddy admin API → add reverse proxy route                    │
│  5. Status: pending → cloning → building → deploying → running   │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Caddy (Reverse Proxy)                                          │
│  :80 (HTTP) + :2019 (Admin API)                                 │
│                                                                  │
│  Routes added dynamically via admin API:                         │
│  {id}.localhost → localhost:{port}                               │
│                                                                  │
│  Each deployment gets a unique subdomain.                        │
│  Routes are cleaned up on deployment deletion.                   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Why Bun + Express
Bun for fast startup and native TypeScript execution. Express because it's battle-tested and the task doesn't need framework features — just routes and middleware. Could have used Hono (lighter) but Express was faster to ship with existing patterns.

### Why SQLite
Single-file database, no external service needed, works perfectly with `docker compose up` — no Postgres container to configure. State is simple (one table) and doesn't need relational complexity. For a production system, I'd use PostgreSQL.

### Why SSE over WebSocket
The log stream is one-directional (server → client). SSE is simpler than WebSocket for one-way streaming, browser-native (EventSource API), auto-reconnects, and doesn't need a library. WebSocket would be overkill for this use case.

### Caddy Dynamic Routing
Instead of a static Caddyfile, the backend uses Caddy's admin API (`localhost:2019`) to add and remove routes at runtime. Each deployment gets a subdomain route (`{id}.localhost`) pointing to the container's port. Routes are cleaned up when deployments are deleted (finds route by host match, deletes by index).

Caddy is started with a JSON config that seeds an empty HTTP server — this is necessary because the admin API path (`config/apps/http/servers/srv0/routes`) must exist before routes can be added.

### Static Site Detection
If a cloned repo has no `package.json`, `go.mod`, or `requirements.txt`, the pipeline auto-injects a package.json with `serve` as a static file server. This handles plain HTML/CSS repos without requiring the user to configure anything.

### Port Assignment
Ports are assigned incrementally starting from 4000, based on the highest port in the database. This is naive — in production I'd use Docker's random port allocation and read the assigned port from the container inspection.

### Log Persistence
Logs are appended to the deployment record in SQLite as a text field. When a client connects to the SSE endpoint, existing logs are sent first (satisfying the "scroll back after the fact" requirement), then new lines stream live via EventEmitter.

## Tech Stack

- **Runtime:** Bun
- **Backend:** Express 5 + TypeScript
- **Database:** SQLite (via Drizzle ORM)
- **Build Tool:** Railpack (auto-detects framework, produces Docker images)
- **Container Runtime:** Docker
- **Reverse Proxy:** Caddy 2 (dynamic routing via admin API)
- **Frontend:** Vite + React + TypeScript + TanStack Query + Tailwind CSS
- **Log Streaming:** Server-Sent Events (SSE)
- **Validation:** express-validator

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/deployments` | Create deployment from Git URL |
| GET | `/api/deployments` | List all deployments |
| GET | `/api/deployments/:id` | Get single deployment |
| GET | `/api/deployments/:id/logs` | Stream build/deploy logs (SSE) |
| DELETE | `/api/deployments/:id` | Stop container, remove Caddy route, delete record |

### POST /api/deployments

```bash
curl -X POST http://localhost:8080/api/deployments \
  -H "Content-Type: application/json" \
  -d '{"git_url": "https://github.com/user/repo"}'
```

Response:
```json
{
  "project": {
    "id": "e3ee1673-f959-4b97-8149-48f257a406fa",
    "gitUrl": "https://github.com/user/repo",
    "status": "pending",
    "imageTag": null,
    "liveUrl": null,
    "port": 0,
    "logs": "",
    "createdAt": "2026-04-23T16:00:00.000Z"
  }
}
```

### GET /api/deployments/:id/logs (SSE)

```bash
curl -N http://localhost:8080/api/deployments/{id}/logs
```

Each event:
```
data: {"line":"Cloning into '.'..."}

data: {"line":"INFO Successfully built image in 5.34s"}

data: {"line":"✅ Deployment live at http://{id}.localhost"}
```

## Setup

### Prerequisites

- Docker and Docker Compose installed
- Git installed

### Run with Docker Compose

```bash
git clone https://github.com/Verifieddanny/brimble-submission.git
cd brimble-submission
docker compose up
```

Frontend: `http://localhost:5173`
API: `http://localhost:8080`
Caddy Admin: `http://localhost:2019`

### Run Locally (without Docker Compose)

```bash
# Terminal 1 — Start Caddy
sudo caddy start --config brimble-engine/caddy.json

# Terminal 2 — Start BuildKit (required for Railpack)
docker run --rm --privileged -d --name buildkit moby/buildkit

# Terminal 3 — Start Backend
cd brimble-engine
bun install
bunx drizzle-kit generate
bunx drizzle-kit push
bun dev

# Terminal 4 — Start Frontend
cd brimble-ui
npm install
npm run dev
```

### Environment Variables

Backend (`.env`):
```
PORT=8080
CADDY_ENDPOINT=http://localhost:2019/config/apps/http/servers/srv0/routes
```

## Project Structure

```
brimble-submission/
├── docker-compose.yml
├── brimble-engine/              # Backend
│   ├── src/
│   │   ├── controller/
│   │   │   └── deployments.ts   # CRUD + SSE log streaming
│   │   ├── db/
│   │   │   ├── index.ts         # SQLite + Drizzle connection
│   │   │   └── schema.ts        # Deployment table schema
│   │   ├── routes/
│   │   │   └── deployments.ts   # Route definitions
│   │   ├── service/
│   │   │   └── deployment.service.ts  # Pipeline: clone → build → deploy → route
│   │   ├── shared/
│   │   │   └── types.ts
│   │   ├── validation/
│   │   │   └── deployments.ts
│   │   └── index.ts             # Express entry point
│   ├── caddy.json               # Caddy config (empty HTTP server for admin API)
│   ├── drizzle.config.ts
│   └── package.json
├── brimble-ui/                  # Frontend
│   ├── src/
│   │   ├── App.tsx              # Single-page deployment dashboard
│   │   └── main.tsx
│   ├── vite.config.ts           # Proxy /api to backend
│   └── package.json
└── README.md
```

## What I'd Do With More Time

- **Build caching with Railpack** — reuse layers across deploys to reduce build time from ~5-380s to seconds
- **Health checks** — poll the container before marking as "running" to ensure the app actually started
- **Graceful container shutdown** — send SIGTERM, wait, then SIGKILL instead of `docker rm -f`
- **Dynamic port detection** — inspect the built image's exposed ports instead of assuming port 80
- **Zero-downtime redeploys** — start new container, verify health, switch Caddy route, stop old container
- **Rollback** — store previous image tags, allow redeploying a known-good version
- **Rate limiting** — prevent abuse of the deploy endpoint
- **Build queue** — serialize builds to prevent resource exhaustion on the host

## What I'd Rip Out

- **Port assignment logic** — incrementing from the DB is fragile. Docker's `--publish-all` with port inspection is more robust
- **Log storage as text blob** — works for this scope but structured log entries with timestamps would be better for filtering and search
- **Static site detection heuristic** — checking for package.json/go.mod/requirements.txt is basic. Railpack's own detection should handle this, but the fallback was needed for repos with no manifest

## Time Spent

- Backend (pipeline, API, SSE): ~5 hours
- Caddy configuration and debugging: ~2 hours
- Frontend (Vite + TanStack, deployment UI, log viewer): ~2 hours
- Docker Compose + Dockerfiles: ~1 hour
- README + documentation: ~30 minutes
- Total: ~10.5 hours


## Author

**Danny (DevDanny)** — [@dannyclassi_c](https://x.com/dannyclassi_c)

Built Shipyard (a CI/CD deployment engine with similar architecture) as a previous project: [github.com/Verifieddanny/cicd-engine](https://github.com/Verifieddanny/cicd-engine) | Live: [useshipyard.xyz](https://useshipyard.xyz)