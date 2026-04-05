use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;

use crate::models::events::KafkaEventMessage;
use crate::models::pricing;

/// Aggregated metrics extracted from a session's streaming events.
/// This is the pure computation result before it touches the database.
#[derive(Debug, Clone)]
pub struct SessionMetrics {
    pub user_id: String,
    pub team_id: String,
    pub model: String,
    pub status: String,
    pub error_category: Option<String>,
    pub date: NaiveDate,
    pub timestamp: DateTime<Utc>,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_creation: i64,
    pub cache_read: i64,
    pub cost: Decimal,
    pub tool_calls: i32,
    pub tool_errors: i32,
    pub iterations: i32,
}

/// Extract aggregated metrics from a session's streaming events.
/// Pure function -- no database, no side effects.
pub fn aggregate_session_events(events: &[KafkaEventMessage]) -> anyhow::Result<SessionMetrics> {
    let start = events
        .iter()
        .find(|e| e.event_type == "SessionStart")
        .ok_or_else(|| anyhow::anyhow!("no SessionStart event"))?;

    let user_id = start.payload["userId"].as_str().unwrap_or("").to_string();
    let team_id = start.payload["teamId"].as_str().unwrap_or("").to_string();
    let model = start.payload["model"].as_str().unwrap_or("sonnet").to_string();

    let end = events
        .iter()
        .find(|e| e.event_type == "SessionEnd")
        .ok_or_else(|| anyhow::anyhow!("no SessionEnd event"))?;

    let status = end.payload["status"].as_str().unwrap_or("completed").to_string();
    let error_category = end.payload["errorCategory"].as_str().map(|s| s.to_string());

    let mut total_input: i64 = 0;
    let mut total_output: i64 = 0;
    let mut total_cache_creation: i64 = 0;
    let mut total_cache_read: i64 = 0;

    for event in events.iter().filter(|e| e.event_type == "Usage") {
        total_input += event.payload["inputTokens"].as_i64().unwrap_or(0);
        total_output += event.payload["outputTokens"].as_i64().unwrap_or(0);
        total_cache_creation += event.payload["cacheCreationInputTokens"].as_i64().unwrap_or(0);
        total_cache_read += event.payload["cacheReadInputTokens"].as_i64().unwrap_or(0);
    }

    let cost = pricing::calculate_cost(&model, total_input, total_output, total_cache_creation, total_cache_read);

    let tool_calls = events.iter().filter(|e| e.event_type == "ToolUse").count() as i32;
    let tool_errors = events
        .iter()
        .filter(|e| e.event_type == "ToolResult" && e.payload["isError"].as_bool() == Some(true))
        .count() as i32;
    let iterations = events.iter().filter(|e| e.event_type == "MessageStop").count() as i32;

    Ok(SessionMetrics {
        user_id,
        team_id,
        model,
        status,
        error_category,
        date: start.timestamp.date_naive(),
        timestamp: start.timestamp,
        input_tokens: total_input,
        output_tokens: total_output,
        cache_creation: total_cache_creation,
        cache_read: total_cache_read,
        cost,
        tool_calls,
        tool_errors,
        iterations,
    })
}

/// Process a completed session's events and upsert into baked PostgreSQL tables.
pub async fn process_session(pg: &PgPool, events: &[KafkaEventMessage]) -> anyhow::Result<()> {
    let m = aggregate_session_events(events)?;

    let err_api = i32::from(m.error_category.as_deref() == Some("api"));
    let err_tool = i32::from(m.error_category.as_deref() == Some("tool"));
    let err_perm = i32::from(m.error_category.as_deref() == Some("permission"));
    let err_runtime = i32::from(m.error_category.as_deref() == Some("runtime"));

    let is_completed = m.status == "completed";
    let is_errored = m.status == "error";
    let is_cancelled = m.status == "cancelled";

    upsert_daily_session_summary(pg, m.date, &m.team_id, &m.model, is_completed, is_errored, is_cancelled, m.cost).await?;
    upsert_daily_token_stats(pg, m.date, &m.team_id, &m.model, m.input_tokens, m.output_tokens, m.cache_creation, m.cache_read, m.cost).await?;
    upsert_daily_quality_stats(pg, m.date, &m.team_id, &m.model, is_completed, m.tool_calls, m.tool_errors, err_api, err_tool, err_perm, err_runtime).await?;
    upsert_team_user_stats(pg, &m.user_id, &m.team_id, m.date, m.cost, is_completed, m.timestamp).await?;

    Ok(())
}

async fn upsert_daily_session_summary(
    pg: &PgPool, date: NaiveDate, team_id: &str, model: &str,
    completed: bool, errored: bool, cancelled: bool, cost: Decimal,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO daily_session_summary (date, team_id, model, total_sessions, completed, errored, cancelled, total_cost, active_users)
         VALUES ($1, $2, $3, 1, $4, $5, $6, $7, 1)
         ON CONFLICT (date, team_id, model) DO UPDATE SET
           total_sessions = daily_session_summary.total_sessions + 1,
           completed = daily_session_summary.completed + $4,
           errored = daily_session_summary.errored + $5,
           cancelled = daily_session_summary.cancelled + $6,
           total_cost = daily_session_summary.total_cost + $7",
    )
    .bind(date).bind(team_id).bind(model)
    .bind(i32::from(completed)).bind(i32::from(errored)).bind(i32::from(cancelled))
    .bind(cost)
    .execute(pg).await?;
    Ok(())
}

async fn upsert_daily_token_stats(
    pg: &PgPool, date: NaiveDate, team_id: &str, model: &str,
    input_tokens: i64, output_tokens: i64, cache_creation: i64, cache_read: i64, cost: Decimal,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO daily_token_stats (date, team_id, model, input_tokens, output_tokens, cache_creation, cache_read, total_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (date, team_id, model) DO UPDATE SET
           input_tokens = daily_token_stats.input_tokens + $4,
           output_tokens = daily_token_stats.output_tokens + $5,
           cache_creation = daily_token_stats.cache_creation + $6,
           cache_read = daily_token_stats.cache_read + $7,
           total_cost = daily_token_stats.total_cost + $8",
    )
    .bind(date).bind(team_id).bind(model)
    .bind(input_tokens).bind(output_tokens).bind(cache_creation).bind(cache_read)
    .bind(cost)
    .execute(pg).await?;
    Ok(())
}

async fn upsert_daily_quality_stats(
    pg: &PgPool, date: NaiveDate, team_id: &str, model: &str,
    completed: bool, tool_calls: i32, tool_errors: i32,
    errors_api: i32, errors_tool: i32, errors_permission: i32, errors_runtime: i32,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO daily_quality_stats (date, team_id, model, total_sessions, completed, tool_calls, tool_errors, errors_api, errors_tool, errors_permission, errors_runtime)
         VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (date, team_id, model) DO UPDATE SET
           total_sessions = daily_quality_stats.total_sessions + 1,
           completed = daily_quality_stats.completed + $4,
           tool_calls = daily_quality_stats.tool_calls + $5,
           tool_errors = daily_quality_stats.tool_errors + $6,
           errors_api = daily_quality_stats.errors_api + $7,
           errors_tool = daily_quality_stats.errors_tool + $8,
           errors_permission = daily_quality_stats.errors_permission + $9,
           errors_runtime = daily_quality_stats.errors_runtime + $10",
    )
    .bind(date).bind(team_id).bind(model)
    .bind(i32::from(completed))
    .bind(tool_calls).bind(tool_errors)
    .bind(errors_api).bind(errors_tool).bind(errors_permission).bind(errors_runtime)
    .execute(pg).await?;
    Ok(())
}

async fn upsert_team_user_stats(
    pg: &PgPool, user_id: &str, team_id: &str, date: NaiveDate,
    cost: Decimal, completed: bool, last_active: DateTime<Utc>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO team_user_stats (user_id, team_id, date, sessions, cost, completed, last_active)
         VALUES ($1, $2, $3, 1, $4, $5, $6)
         ON CONFLICT (user_id, date) DO UPDATE SET
           sessions = team_user_stats.sessions + 1,
           cost = team_user_stats.cost + $4,
           completed = team_user_stats.completed + $5,
           last_active = GREATEST(team_user_stats.last_active, $6)",
    )
    .bind(user_id).bind(team_id).bind(date)
    .bind(cost).bind(i32::from(completed)).bind(last_active)
    .execute(pg).await?;
    Ok(())
}
