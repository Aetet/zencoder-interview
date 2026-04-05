pub mod aggregator;
pub mod alerts;
#[cfg(feature = "kafka")]
pub mod consumer;

use sqlx::PgPool;

use crate::models::budget;

#[cfg(feature = "kafka")]
pub async fn run(pg: &PgPool) -> anyhow::Result<()> {
    let kafka_consumer = crate::kafka::consumer::EventConsumer::new()?;
    consumer::run(kafka_consumer, pg).await
}

pub async fn copy_reference_data(
    tsdb: &sqlx::PgPool,
    pg: &PgPool,
) -> anyhow::Result<()> {
    // Copy teams
    let teams = sqlx::query_as::<_, (String, String)>("SELECT id, name FROM teams")
        .fetch_all(tsdb)
        .await?;

    for (id, name) in &teams {
        sqlx::query("INSERT INTO teams (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING")
            .bind(id)
            .bind(name)
            .execute(pg)
            .await?;
    }
    tracing::info!("copied {} teams to PostgreSQL", teams.len());

    // Copy users
    let users =
        sqlx::query_as::<_, (String, String, String)>("SELECT id, email, team_id FROM users")
            .fetch_all(tsdb)
            .await?;

    for (id, email, team_id) in &users {
        sqlx::query(
            "INSERT INTO users (id, email, team_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
        )
        .bind(id)
        .bind(email)
        .bind(team_id)
        .execute(pg)
        .await?;
    }
    tracing::info!("copied {} users to PostgreSQL", users.len());

    // Initialize budget config from constants
    let thresholds: Vec<i32> = budget::DEFAULT_THRESHOLDS.to_vec();
    let overrides_json = build_overrides_json();

    sqlx::query(
        "INSERT INTO budget_config (id, monthly_budget, thresholds, team_overrides)
         VALUES (1, $1, $2, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(budget::DEFAULT_MONTHLY_BUDGET)
    .bind(&thresholds)
    .bind(overrides_json)
    .execute(pg)
    .await?;
    tracing::info!("initialized budget config (${}/month)", budget::DEFAULT_MONTHLY_BUDGET);

    Ok(())
}

fn build_overrides_json() -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (team_id, amount) in budget::DEFAULT_TEAM_OVERRIDES {
        let f: f64 = rust_decimal::prelude::ToPrimitive::to_f64(amount).unwrap_or(0.0);
        map.insert(
            team_id.to_string(),
            serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap()),
        );
    }
    serde_json::Value::Object(map)
}
