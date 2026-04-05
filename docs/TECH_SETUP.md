# Technical Setup

Operational reference: connection strings, simulator commands, data reset, troubleshooting.

## Architecture

```
Simulator (Rust) → TimescaleDB → Kafka → Transformer (Rust) → PostgreSQL → Backend (TS) → Frontend (React)
```

| Component | Port | Purpose |
|-----------|------|---------|
| TimescaleDB | 5433 | Raw streaming agent events |
| Kafka | 9092 | Message queue (optional for `poll` mode) |
| PostgreSQL | 5432 | Pre-aggregated dashboard tables |
| Backend | 3001 | Hono API, reads from PostgreSQL |
| Frontend | 5173 | React + Reatom, live SSE |

## Connection Strings

| Service | URL |
|---------|-----|
| TimescaleDB | `postgres://zendash:zendash_dev@localhost:5433/zendash_events` |
| PostgreSQL | `postgres://zendash:zendash_dev@localhost:5432/zendash` |
| Kafka | `localhost:9092` |

## Simulator Commands

```bash
cd services/rust-simulator

# Recommended for dev: seed 3 days + poll new data every 30s (no Kafka needed)
cargo run -- poll

# Full 30-day simulation (writes to TimescaleDB only, needs Kafka for transform)
cargo run -- simulate

# Full pipeline: simulate + transform + real-time
cargo run -- all

# Observation tools
cargo run -- status          # TimescaleDB: event counts, sessions, breakdown
cargo run -- verify          # PostgreSQL: baked table stats, metrics, quality
cargo run -- kafka-monitor   # Kafka: partitions, lag (needs --features kafka)
```

## UI Features

- **Overview** — live-updating KPIs, charts, team leaderboard via SSE
- **Turbo (No DB)** button — stress-tests UI at 15 updates/sec with generated data, no database
- **Cost & Usage** — token breakdown, cache efficiency, budget tracker
- **Teams** — virtualized grid (1000+ teams), per-user drill-down
- **Quality** — success rate, error categories, tool error rate
- **Alerts** — budget thresholds, spend spikes

## Running Tests

```bash
# Backend (79 tests, no DB needed)
pnpm test -F backend

# Rust simulator (54 tests)
cd services/rust-simulator && cargo test

# Frontend
pnpm test -F frontend

# All JS tests
pnpm test
```

## Full Pipeline via Docker

Builds Rust simulator inside container with Kafka support (~2 min first build):

```bash
docker compose up -d --build
pnpm dev
```

## Resetting Data

```bash
# Full reset — wipe volumes, rebuild
docker compose down -v
docker compose up -d timescaledb postgres

# Just clear databases (keep containers)
PGPASSWORD=zendash_dev psql -h localhost -p 5433 -U zendash -d zendash_events \
  -c "TRUNCATE agent_events, users, teams CASCADE;"
PGPASSWORD=zendash_dev psql -h localhost -p 5432 -U zendash -d zendash \
  -c "TRUNCATE daily_session_summary, daily_token_stats, daily_quality_stats, team_user_stats, alerts_log CASCADE; DELETE FROM users; DELETE FROM teams; DELETE FROM budget_config;"
```

## Troubleshooting

**Simulator shows "already has N events, skipping"**
Data exists from a previous run. Reset TimescaleDB (see above).

**Backend returns empty data**
Simulator hasn't populated PostgreSQL yet. Check:
```bash
PGPASSWORD=zendash_dev psql -h localhost -p 5432 -U zendash -d zendash \
  -c "SELECT SUM(total_sessions) FROM daily_session_summary;"
```

**Docker build fails on simulator**
First build takes ~3 min (compiles Rust + librdkafka). Subsequent builds use cache.

**Port conflicts**
Stop conflicting services or change ports in `docker-compose.yml`.

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
└── docs/                          # All documentation (see ENTRY_POINT.md)
```
