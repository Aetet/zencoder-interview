# ZenDash — AI Agent Cost Dashboard

Dashboard for monitoring AI agent usage: costs, sessions, teams, quality metrics. Real data pipeline with Rust simulator, TimescaleDB, Kafka, PostgreSQL.

## Documentation

| Document | What's inside |
|----------|---------------|
| [docs/mvp/mvp-scope.md](docs/mvp/mvp-scope.md) | MVP scope — 4 views, features, tech stack |
| [docs/mvp/architecture.md](docs/mvp/architecture.md) | Frontend/backend architecture, monorepo structure |
| [docs/mvp/reatom-patterns.md](docs/mvp/reatom-patterns.md) | Reatom state management patterns used in the frontend |
| [docs/mvp/design-system.md](docs/mvp/design-system.md) | UI design system — colors, typography, components |
| [docs/reference-agent/](docs/reference-agent/) | Reference AI agent (Claw Code) — sessions, events, tools, errors |
| [docs/mvp/stage-1/README.md](docs/mvp/stage-1/README.md) | Stage 1 architecture — pipeline overview, component roles, decisions |
| [docs/mvp/stage-1/data-model.md](docs/mvp/stage-1/data-model.md) | Full data model — streaming events, Kafka messages, baked PG tables, field-by-field explanations |
| [docs/mvp/stage-1/api-spec.md](docs/mvp/stage-1/api-spec.md) | Every API endpoint mapped to PostgreSQL queries |
| [docs/mvp/stage-1/implementation-plan.md](docs/mvp/stage-1/implementation-plan.md) | Implementation phases, Rust project structure, Docker setup |

## Architecture

```
Simulator (Rust) → TimescaleDB → Kafka → Transformer (Rust) → PostgreSQL → Backend (TS) → Frontend (React)
```

| Component | What it does | Port |
|-----------|-------------|------|
| **TimescaleDB** | Stores raw streaming agent events | 5433 |
| **Kafka** | Message queue between simulator and transformer | 9092 |
| **PostgreSQL** | Pre-aggregated tables the dashboard reads | 5432 |
| **Backend** | Hono API, reads from PostgreSQL | 3001 |
| **Frontend** | React + Reatom, live SSE updates | 5173 |
| **Simulator** | Rust binary that generates + transforms data | — |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for databases + Kafka)
- [Devbox](https://www.jetify.com/devbox/docs/installing_devbox/) (handles Node, pnpm, Rust, cmake)

```bash
# Install devbox (if not installed)
curl -fsSL https://get.jetify.com/devbox | bash
```

## Setup (first time)

```bash
# 1. Enter devbox shell — installs Node 20, pnpm 9, Rust, cmake, librdkafka
devbox shell

# 2. Install JS dependencies
pnpm install

# 3. Start infrastructure (TimescaleDB, PostgreSQL, Kafka)
docker compose up -d

# 4. Wait for healthy databases (~5 seconds)
docker compose ps
```

## Running

Two terminals, both inside `devbox shell`:

### Terminal 1 — Simulator

```bash
cd services/rust-simulator
cargo run -- poll
```

Seeds 3 days of history, then generates ~900 sessions every 30s directly into both databases.

### Terminal 2 — Backend + Frontend

```bash
pnpm dev
```

Backend on http://localhost:3001, frontend on http://localhost:5173.

### Alternative: Full pipeline via Docker

Builds the Rust simulator in a container with Kafka support (~2 min first build):

```bash
docker compose up -d --build
pnpm dev
```

## Quick Start (copy-paste)

```bash
devbox shell
pnpm install
docker compose up -d timescaledb postgres
```

Then in two terminals:

```bash
# Terminal 1 — simulator (seeds data + polls new sessions every 30s)
devbox shell
cd services/rust-simulator && cargo run -- poll

# Terminal 2 — backend + frontend
devbox shell
pnpm dev
```

Open http://localhost:5173 — the overview page is live by default.

> `poll` mode writes directly to both databases — no Kafka needed.
> For full pipeline with Kafka, use `docker compose up -d` instead (starts all 5 services).

## Simulator Commands

```bash
cd services/rust-simulator

# Seed 3 days + poll new data every 30s (recommended for dev)
cargo run -- poll

# Full 30-day simulation (requires Kafka running)
cargo run -- simulate

# Full pipeline: simulate + transform + real-time
cargo run -- all

# Observation tools
cargo run -- status          # TimescaleDB stats: events, sessions, breakdown
cargo run -- verify          # PostgreSQL stats: baked tables, metrics, quality
cargo run -- kafka-monitor   # Kafka: partitions, lag (needs --features kafka)
```

## UI Features

- **Overview** — live-updating KPIs, charts, team leaderboard via SSE
- **Turbo (No DB)** button — stress-tests the UI at 15 updates/sec with generated data, no database
- **Cost & Usage** — token breakdown, cache efficiency, budget tracker
- **Teams** — virtualized grid (1000+ teams), per-user drill-down
- **Quality** — success rate, error categories, tool error rate
- **Alerts** — budget thresholds, spend spikes

## Connection Strings

| Service | URL |
|---------|-----|
| TimescaleDB (raw events) | `postgres://zendash:zendash_dev@localhost:5433/zendash_events` |
| PostgreSQL (dashboard data) | `postgres://zendash:zendash_dev@localhost:5432/zendash` |
| Kafka | `localhost:9092` |

## Running Tests

```bash
# Backend (79 tests, no DB needed — uses mock pool)
pnpm test -F backend

# Rust simulator (54 tests)
cd services/rust-simulator && cargo test

# Frontend
pnpm test -F frontend

# All
pnpm test
```

## Project Structure

```
├── docker-compose.yml              # TimescaleDB, PostgreSQL, Kafka, Simulator
├── devbox.json                     # Reproducible dev environment
├── packages/
│   ├── backend/                    # Hono API server (TypeScript)
│   │   └── src/routes/             # Endpoints reading from PostgreSQL
│   ├── frontend/                   # React + Reatom dashboard
│   └── shared/                     # Shared types between backend & frontend
├── services/
│   └── rust-simulator/             # Event simulator + transformer (Rust)
│       ├── migrations/
│       │   ├── timescaledb/        # Raw event schema (hypertable)
│       │   └── postgres/           # Baked table schema (per-endpoint)
│       ├── src/
│       │   ├── simulator/          # Generates streaming agent events
│       │   ├── transformer/        # Aggregates events → dashboard tables
│       │   └── observe.rs          # status, verify, kafka-monitor commands
│       └── tests/                  # 54 tests with deterministic fixtures
└── docs/
    └── mvp/stage-1/               # Architecture docs, data model, API spec
```

## Resetting Data

```bash
# Full reset — wipe volumes, rebuild everything
docker compose down -v
docker compose up -d --build

# Just clear databases (keep containers running)
PGPASSWORD=zendash_dev psql -h localhost -p 5433 -U zendash -d zendash_events \
  -c "TRUNCATE agent_events, users, teams CASCADE;"
PGPASSWORD=zendash_dev psql -h localhost -p 5432 -U zendash -d zendash \
  -c "TRUNCATE daily_session_summary, daily_token_stats, daily_quality_stats, team_user_stats, alerts_log CASCADE; DELETE FROM users; DELETE FROM teams; DELETE FROM budget_config;"
```

## Troubleshooting

**Simulator shows "already has N events, skipping"**
Data exists from a previous run. Reset TimescaleDB (see above) or it will use existing data.

**Backend returns empty data**
The simulator hasn't populated PostgreSQL yet. Check with:
```bash
PGPASSWORD=zendash_dev psql -h localhost -p 5432 -U zendash -d zendash \
  -c "SELECT SUM(total_sessions) FROM daily_session_summary;"
```

**Docker build fails on simulator**
First build takes ~3 min (compiles Rust + librdkafka). Subsequent builds use cache.

**Port conflicts**
Default ports: 5432 (PostgreSQL), 5433 (TimescaleDB), 9092 (Kafka), 3001 (backend), 5173 (frontend). Stop conflicting services or change ports in `docker-compose.yml`.
