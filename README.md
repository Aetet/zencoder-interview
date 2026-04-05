# ZenDash — AI Agent Cost Dashboard

Dashboard for monitoring AI agent usage: costs, sessions, teams, quality metrics. Real data pipeline with Rust simulator, TimescaleDB, Kafka, PostgreSQL.

## Documentation

Start here: [docs/ENTRY_POINT.md](docs/ENTRY_POINT.md)

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

# 3. Start infrastructure (TimescaleDB, PostgreSQL)
docker compose up -d timescaledb postgres

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
