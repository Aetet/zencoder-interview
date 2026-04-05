use sqlx::PgPool;
use tokio::time::{interval, Duration};

use crate::db::timescale;
use crate::simulator::session;

/// Generate new sessions continuously (~1-2 every 30 seconds).
pub async fn run(tsdb: &PgPool) -> anyhow::Result<()> {
    let users = load_users(tsdb).await?;
    if users.is_empty() {
        anyhow::bail!("no users found in TimescaleDB, run simulate first");
    }

    #[cfg(feature = "kafka")]
    let producer = crate::kafka::producer::EventProducer::new().ok();
    #[cfg(feature = "kafka")]
    if producer.is_none() {
        tracing::warn!("kafka producer not available in realtime mode");
    }

    let mut tick = interval(Duration::from_secs(30));
    tracing::info!("real-time mode started, generating ~1-2 sessions every 30s");

    loop {
        tick.tick().await;

        let sessions = session::generate_day_sessions(&users, 0, 2);

        for session_events in &sessions {
            timescale::insert_events(tsdb, session_events).await?;
            #[cfg(feature = "kafka")]
            if let Some(ref p) = producer {
                p.send_batch(session_events).await?;
            }
            tracing::debug!(
                "real-time: generated session with {} events",
                session_events.len()
            );
        }
    }
}

async fn load_users(tsdb: &PgPool) -> anyhow::Result<Vec<crate::models::team::User>> {
    let rows = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, email, team_id FROM users"
    )
    .fetch_all(tsdb)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, email, team_id)| crate::models::team::User {
            id,
            email,
            team_id,
        })
        .collect())
}
