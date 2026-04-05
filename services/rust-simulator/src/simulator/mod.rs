pub mod generator;
pub mod realtime;
pub mod session;

use sqlx::PgPool;
use tokio::time::{interval, Duration};

use crate::db::timescale;
use crate::models::events::KafkaEventMessage;
use crate::transformer::aggregator;
use crate::transformer::alerts;

pub async fn run_historical(tsdb: &PgPool) -> anyhow::Result<()> {
    let team_count: i64 = std::env::var("TEAM_COUNT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1000);
    let sessions_per_day: i64 = std::env::var("SESSIONS_PER_DAY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300);
    let history_days: i64 = std::env::var("HISTORY_DAYS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    run_seed(tsdb, history_days as u32, sessions_per_day as u32).await?;

    // Also publish to Kafka if available
    #[cfg(feature = "kafka")]
    {
        tracing::info!("publishing events to Kafka...");
        let producer = crate::kafka::producer::EventProducer::new().ok();
        if let Some(ref p) = producer {
            let rows = sqlx::query_as::<_, (String, i32, String, serde_json::Value, chrono::DateTime<chrono::Utc>)>(
                "SELECT session_id, seq, event_type, payload, ts FROM agent_events ORDER BY session_id, seq"
            ).fetch_all(tsdb).await?;

            for row in &rows {
                let event = crate::models::events::AgentEvent {
                    session_id: row.0.clone(),
                    seq: row.1,
                    event_type: serde_json::from_value(serde_json::Value::String(row.2.clone())).unwrap_or(crate::models::events::EventType::TextDelta),
                    payload: row.3.clone(),
                    ts: row.4,
                };
                p.send(&event).await?;
            }
            tracing::info!("published {} events to Kafka", rows.len());
        }
    }

    Ok(())
}

/// Seed N days of historical data into TimescaleDB. Skips if data exists.
pub async fn run_seed(tsdb: &PgPool, days: u32, sessions_per_day: u32) -> anyhow::Result<()> {
    let team_count: usize = std::env::var("TEAM_COUNT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1000);

    // Check if data already exists
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM agent_events")
        .fetch_one(tsdb)
        .await?;
    if count.0 > 0 {
        tracing::info!("TimescaleDB already has {} events, skipping seed", count.0);
        return Ok(());
    }

    let teams = generator::generate_teams(team_count);
    let users = generator::generate_users(&teams);
    tracing::info!("generated {} users across {} teams", users.len(), teams.len());

    timescale::insert_teams(tsdb, &teams).await?;
    timescale::insert_users(tsdb, &users).await?;

    tracing::info!("generating {} days of sessions ({}/day)...", days, sessions_per_day);

    let mut total_events = 0u64;
    let mut total_sessions = 0u64;

    for day in (0..days).rev() {
        let day_sessions = session::generate_day_sessions(&users, day, sessions_per_day);

        for session_events in &day_sessions {
            timescale::insert_events(tsdb, session_events).await?;
            total_events += session_events.len() as u64;
            total_sessions += 1;
        }
    }

    tracing::info!("seed complete: {} sessions, {} events", total_sessions, total_events);
    Ok(())
}

/// Read all sessions from TimescaleDB and write aggregated data directly to PostgreSQL.
pub async fn backfill_to_postgres(tsdb: &PgPool, pg: &PgPool) -> anyhow::Result<()> {
    let session_ids = sqlx::query_as::<_, (String,)>(
        "SELECT DISTINCT session_id FROM agent_events ORDER BY session_id",
    )
    .fetch_all(tsdb)
    .await?;

    tracing::info!("backfilling {} sessions to PostgreSQL...", session_ids.len());
    let mut processed = 0u64;

    for (session_id,) in &session_ids {
        let rows = sqlx::query_as::<_, (String, i32, String, serde_json::Value, chrono::DateTime<chrono::Utc>)>(
            "SELECT session_id, seq, event_type, payload, ts FROM agent_events WHERE session_id = $1 ORDER BY seq",
        )
        .bind(session_id)
        .fetch_all(tsdb)
        .await?;

        let events: Vec<KafkaEventMessage> = rows
            .into_iter()
            .map(|(sid, seq, event_type, payload, ts)| KafkaEventMessage {
                session_id: sid,
                seq,
                event_type,
                payload,
                timestamp: ts,
            })
            .collect();

        if let Err(e) = aggregator::process_session(pg, &events).await {
            tracing::warn!("skipping session {}: {}", session_id, e);
            continue;
        }

        processed += 1;
        if processed % 1000 == 0 {
            tracing::info!("backfilled {}/{} sessions", processed, session_ids.len());
        }
    }

    // Generate alerts after backfill
    alerts::generate_alerts(pg).await?;
    tracing::info!("backfill complete: {} sessions", processed);
    Ok(())
}

/// Poll mode: generate 2-3 days worth of sessions (~600-900) every 30s,
/// write to both TimescaleDB and PostgreSQL directly.
pub async fn run_poll(tsdb: &PgPool, pg: &PgPool) -> anyhow::Result<()> {
    let users = load_users(tsdb).await?;
    if users.is_empty() {
        anyhow::bail!("no users in TimescaleDB");
    }

    let sessions_per_day: u32 = std::env::var("SESSIONS_PER_DAY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300);

    let mut tick = interval(Duration::from_secs(30));
    let mut total = 0u64;

    loop {
        tick.tick().await;

        // Generate 3 days worth of sessions in one batch
        let mut batch_count = 0u64;
        for day in 0..3 {
            let day_sessions = session::generate_day_sessions(&users, day, sessions_per_day);

            for session_events in &day_sessions {
                timescale::insert_events(tsdb, session_events).await?;

                let kafka_events: Vec<KafkaEventMessage> = session_events
                    .iter()
                    .map(|e| KafkaEventMessage {
                        session_id: e.session_id.clone(),
                        seq: e.seq,
                        event_type: e.event_type.as_str().to_string(),
                        payload: e.payload.clone(),
                        timestamp: e.ts,
                    })
                    .collect();

                if let Err(e) = aggregator::process_session(pg, &kafka_events).await {
                    tracing::error!("failed to process session: {}", e);
                    continue;
                }

                batch_count += 1;
            }
        }

        total += batch_count;
        tracing::info!("poll: +{} sessions (total: {})", batch_count, total);

        // Refresh alerts after each batch
        if let Err(e) = alerts::generate_alerts(pg).await {
            tracing::error!("alert generation error: {}", e);
        }
    }
}

pub async fn run_realtime(tsdb: &PgPool) -> anyhow::Result<()> {
    realtime::run(tsdb).await
}

async fn load_users(tsdb: &PgPool) -> anyhow::Result<Vec<crate::models::team::User>> {
    let rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, email, team_id FROM users",
    )
    .fetch_all(tsdb)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, email, team_id)| crate::models::team::User { id, email, team_id })
        .collect())
}
