use sqlx::PgPool;

use crate::models::events::AgentEvent;
use crate::models::team::{Team, User};

pub async fn connect_and_migrate() -> anyhow::Result<PgPool> {
    let url = std::env::var("TIMESCALE_URL")
        .unwrap_or_else(|_| "postgres://zendash:zendash_dev@localhost:5433/zendash_events".into());

    let pool = PgPool::connect(&url).await?;
    sqlx::migrate!("./migrations/timescaledb")
        .run(&pool)
        .await?;

    tracing::info!("TimescaleDB migrations applied");
    Ok(pool)
}

pub async fn insert_teams(pool: &PgPool, teams: &[Team]) -> anyhow::Result<()> {
    for chunk in teams.chunks(500) {
        let mut query = String::from("INSERT INTO teams (id, name) VALUES ");
        let mut params: Vec<&str> = Vec::new();

        for (i, team) in chunk.iter().enumerate() {
            if i > 0 {
                query.push_str(", ");
            }
            let base = i * 2 + 1;
            query.push_str(&format!("(${}, ${})", base, base + 1));
            params.push(&team.id);
            params.push(&team.name);
        }
        query.push_str(" ON CONFLICT (id) DO NOTHING");

        let mut q = sqlx::query(&query);
        for p in &params {
            q = q.bind(*p);
        }
        q.execute(pool).await?;
    }
    Ok(())
}

pub async fn insert_users(pool: &PgPool, users: &[User]) -> anyhow::Result<()> {
    for chunk in users.chunks(500) {
        let mut query = String::from("INSERT INTO users (id, email, team_id) VALUES ");
        let mut params: Vec<&str> = Vec::new();

        for (i, user) in chunk.iter().enumerate() {
            if i > 0 {
                query.push_str(", ");
            }
            let base = i * 3 + 1;
            query.push_str(&format!("(${}, ${}, ${})", base, base + 1, base + 2));
            params.push(&user.id);
            params.push(&user.email);
            params.push(&user.team_id);
        }
        query.push_str(" ON CONFLICT (id) DO NOTHING");

        let mut q = sqlx::query(&query);
        for p in &params {
            q = q.bind(*p);
        }
        q.execute(pool).await?;
    }
    Ok(())
}

pub async fn insert_events(pool: &PgPool, events: &[AgentEvent]) -> anyhow::Result<()> {
    for chunk in events.chunks(500) {
        let mut query = String::from(
            "INSERT INTO agent_events (session_id, seq, event_type, payload, ts) VALUES ",
        );

        for (i, _) in chunk.iter().enumerate() {
            if i > 0 {
                query.push_str(", ");
            }
            let base = i * 5 + 1;
            query.push_str(&format!(
                "(${}, ${}, ${}, ${}, ${})",
                base,
                base + 1,
                base + 2,
                base + 3,
                base + 4
            ));
        }
        query.push_str(" ON CONFLICT DO NOTHING");

        let mut q = sqlx::query(&query);
        for event in chunk {
            q = q
                .bind(&event.session_id)
                .bind(event.seq)
                .bind(event.event_type.as_str())
                .bind(&event.payload)
                .bind(event.ts);
        }
        q.execute(pool).await?;
    }
    Ok(())
}
