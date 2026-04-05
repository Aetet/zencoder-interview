# Implementation Plan

## Project Structure

```
services/
  rust-simulator/
    Cargo.toml
    Dockerfile
    migrations/
      timescaledb/                        # sqlx::migrate!("./migrations/timescaledb")
        001_create_teams_users.sql
        002_create_agent_events.sql
        003_create_indexes.sql
      postgres/                           # sqlx::migrate!("./migrations/postgres")
        001_create_teams_users.sql
        002_create_daily_session_summary.sql
        003_create_daily_token_stats.sql
        004_create_daily_quality_stats.sql
        005_create_team_user_stats.sql
        006_create_alerts_log.sql
        007_create_budget_config.sql
    src/
      main.rs                             # clap: simulate | transform | all
      lib.rs
      db/
        mod.rs
        timescale.rs                      # Pool + migrate, insert events
        postgres.rs                       # Pool + migrate, upsert aggregates
      models/
        mod.rs
        events.rs                         # AgentEvent, EventType, payloads
        team.rs                           # Team, User
        pricing.rs                        # MODEL_PRICING, calculate_cost()
      simulator/
        mod.rs
        generator.rs                      # Team/user generation
        session.rs                        # Session event sequence generation
        realtime.rs                       # Background continuous generation
      transformer/
        mod.rs
        consumer.rs                       # Kafka consumer, session buffering
        aggregator.rs                     # Events → session metrics → daily stats
        alerts.rs                         # Alert condition checks
      kafka/
        mod.rs
        producer.rs
        consumer.rs

docker-compose.yml
```

## Database Migrations (sqlx)

Embedded at compile time, run on startup. Separate directories per database.

```rust
// db/timescale.rs
pub async fn connect_and_migrate(url: &str) -> Result<PgPool> {
    let pool = PgPool::connect(url).await?;
    sqlx::migrate!("./migrations/timescaledb")
        .run(&pool)
        .await?;
    Ok(pool)
}

// db/postgres.rs
pub async fn connect_and_migrate(url: &str) -> Result<PgPool> {
    let pool = PgPool::connect(url).await?;
    sqlx::migrate!("./migrations/postgres")
        .run(&pool)
        .await?;
    Ok(pool)
}
```

Dev workflow:
```bash
sqlx migrate add -r --source migrations/timescaledb create_agent_events
sqlx migrate add -r --source migrations/postgres create_daily_summary
```

Every subcommand runs its relevant migrations on startup. Safe to re-run (sqlx tracks in `_sqlx_migrations`).

## Subcommands

```
zendash-simulator simulate     # Migrate TimescaleDB, generate 30 days of events, publish to Kafka
zendash-simulator transform    # Migrate PostgreSQL, consume Kafka, write baked tables
zendash-simulator all          # Both DBs migrated, simulate → transform → real-time mode
```

## Rust Dependencies

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "chrono", "rust_decimal", "migrate"] }
rdkafka = { version = "0.36", features = ["cmake-build"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
clap = { version = "4", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
rand = "0.8"
tracing = "0.1"
tracing-subscriber = "0.3"
uuid = { version = "1", features = ["v4"] }
rust_decimal = { version = "1", features = ["serde-with-str"] }
```

## Docker Compose

```yaml
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_DB: zendash_events
      POSTGRES_USER: zendash
      POSTGRES_PASSWORD: zendash_dev
    ports:
      - "5433:5432"
    volumes:
      - tsdb_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zendash"]
      interval: 5s
      retries: 5

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: zendash
      POSTGRES_USER: zendash
      POSTGRES_PASSWORD: zendash_dev
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zendash"]
      interval: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

volumes:
  tsdb_data:
  pg_data:
```

## Implementation Phases

### Phase 1: Infrastructure + Migrations

1. Create `docker-compose.yml` with all 4 services
2. Create Rust project with Cargo.toml and clap subcommands
3. Write TimescaleDB migrations (001-003): teams, users, agent_events hypertable, indexes
4. Write PostgreSQL migrations (001-007): all baked tables
5. Implement `db/timescale.rs` and `db/postgres.rs` with `connect_and_migrate()`
6. **Verify:** `docker compose up`, run binary -- both DBs migrated

### Phase 2: Event Model + Simulator

1. Define Rust types: `AgentEvent`, `EventType` enum, payload structs for each event type
2. Port team/user generation from TypeScript (same distributions, naming)
3. Implement session event sequence generator:
   - Pick session shape (iterations, tools per iteration)
   - Generate `SessionStart` → `TextDelta`/`ToolUse`/`Usage`/`MessageStop`/`ToolResult` → `SessionEnd`
   - Realistic cache token growth pattern across iterations
   - Weighted tool selection matching real-world usage
4. Implement batch insert to TimescaleDB (batches of events per session)
5. Implement Kafka producer: publish each event after TimescaleDB write
6. **Verify:** ~9000 sessions × ~20 events = ~180K rows in TimescaleDB, messages in Kafka

### Phase 3: Transformer

1. Implement Kafka consumer with `rdkafka`, buffer events per `session_id`
2. On `SessionEnd` event: aggregate buffered events into session metrics
   - Count ToolUse → tool_calls
   - Count ToolResult where isError → tool_errors
   - Sum all Usage events → total tokens
   - Apply pricing → cost
3. Upsert session metrics into daily baked tables (idempotent)
4. Implement alert generation: threshold crossings, budget exceeded, spend spikes
5. Copy teams/users from TimescaleDB to PostgreSQL
6. Initialize budget_config defaults
7. **Verify:** all PostgreSQL baked tables have correct aggregates matching session data

### Phase 4: Real-time Mode

1. Background task generating 1-2 session event sequences every ~30 seconds
2. Full pipeline: events → TimescaleDB → Kafka → Transformer → PostgreSQL
3. `all` subcommand: migrate both DBs → simulate history → start transformer + real-time
4. **Verify:** PostgreSQL updates within seconds of new events

### Phase 5: TypeScript Integration

1. Add PostgreSQL client to TypeScript backend
2. Replace mock data in each route with PG queries (see `api-spec.md`)
3. Budget POST writes to PostgreSQL
4. **Verify:** frontend works identically, existing tests pass

## Environment Variables

```bash
TIMESCALE_URL=postgres://zendash:zendash_dev@localhost:5433/zendash_events
DATABASE_URL=postgres://zendash:zendash_dev@localhost:5432/zendash
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=agent.events
KAFKA_GROUP_ID=zendash-transformer
TEAM_COUNT=1000
SESSIONS_PER_DAY=300
HISTORY_DAYS=30
```

## Verification Checklist

- [ ] `docker compose up` starts all 4 services healthy
- [ ] Binary runs migrations on both databases without errors
- [ ] Migrations are idempotent (re-running is safe)
- [ ] `simulate` generates ~180K events across ~9000 sessions in TimescaleDB
- [ ] Kafka topic `agent.events` has matching messages
- [ ] `transform` populates all PostgreSQL baked tables correctly
- [ ] Event aggregation: token sums, tool counts, error categories match
- [ ] TypeScript reads from PostgreSQL, serves correct API responses
- [ ] Frontend displays data identically to mock data version
- [ ] `POST /api/budgets` persists to PostgreSQL
- [ ] Real-time: new events flow through full pipeline within seconds
- [ ] Migration rollback works for both databases
