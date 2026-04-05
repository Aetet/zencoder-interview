# Stage 1: Rust Simulator + TimescaleDB + Kafka + PostgreSQL Pipeline

## Goal

Replace the TypeScript in-memory mock data with a full data pipeline: Rust simulator generates realistic AI agent session events into TimescaleDB, a Rust transformer consumes them via Kafka, and writes pre-aggregated "baked" data into PostgreSQL tables that the TypeScript backend reads directly.

## Why

The current dashboard uses hardcoded mock data generated at startup in TypeScript memory. This blocks:
- Persistent data across restarts
- Real-time event simulation with actual new data flowing through
- Future integration with real agent telemetry
- Realistic architecture for production deployment

## Data Flow

```
┌───────────┐    ┌─────────────┐    ┌───────┐    ┌────────────┐    ┌──────────┐    ┌────────────┐
│ Simulator │───>│ TimescaleDB │───>│ Kafka │───>│ Rust       │───>│ Postgres │───>│ TypeScript │
│ (Rust)    │    │ (raw events)│    │       │    │ Transformer│    │ (baked)  │    │ (read only)│
└───────────┘    └─────────────┘    └───────┘    └────────────┘    └──────────┘    └────────────┘
```

### Component Roles

| Component | Role | Persistence |
|-----------|------|-------------|
| **Simulator** (Rust) | Generates realistic session events matching reference agent data model | Writes to TimescaleDB |
| **TimescaleDB** | Stores raw session events as time-series data | Source of truth for raw events |
| **Kafka** | Decouples event ingestion from transformation, enables replay | Message queue |
| **Transformer** (Rust) | Consumes events from Kafka, aggregates and transforms into per-endpoint tables | Writes to PostgreSQL |
| **PostgreSQL** | Stores pre-aggregated "baked" data, one table per API endpoint | Read-only for TypeScript |
| **TypeScript** | Simple SELECT queries, no computation, serves API to frontend | Reads from PostgreSQL |

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Raw event store | TimescaleDB | Time-series optimized, hypertables, continuous aggregates for raw data |
| Message queue | Kafka | Decouples simulator from transformer, enables replay and backpressure |
| Baked data store | PostgreSQL | Simple reads, TypeScript-friendly, per-endpoint tables |
| TS integration | Direct PG queries | No Rust API needed for serving; TypeScript reads baked tables directly |
| Baked schema | Per-endpoint tables | One table per API endpoint, TypeScript does `SELECT` with no computation |
| Sim mode | Historical batch + real-time | 30 days on startup, then continuous ~300 sessions/day |
| Event granularity | Session-level | One event per completed session |
| Deployment | Docker Compose | All infra in containers, TypeScript runs locally |
| Rust architecture | Single binary with subcommands | `simulate`, `transform`, or combined mode |

## Scale Target

- ~1000 teams, ~3500 users
- ~300 sessions/day
- 30 days historical data on startup (~9000 sessions)
- Real-time: ~1-2 new sessions every 30 seconds

## Docker Compose Services

```yaml
services:
  timescaledb:    # port 5433 (raw events)
  postgres:       # port 5432 (baked data)
  kafka:          # port 9092
  zookeeper:      # port 2181 (kafka dependency)
  simulator:      # Rust - generates events
```

TypeScript backend runs locally via `pnpm`, reads from `postgres:5432`.
