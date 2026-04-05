use rust_decimal::Decimal;
use sqlx::PgPool;

use crate::models::budget::{
    DEFAULT_THRESHOLDS, MAX_ALERTS, SPIKE_CHECK_TEAM_LIMIT, SPIKE_MULTIPLIER,
};

/// Generate alerts based on current spend vs budget configuration.
/// Called periodically by the transformer after processing sessions.
pub async fn generate_alerts(pg: &PgPool) -> anyhow::Result<()> {
    // Load budget config
    let config = sqlx::query_as::<_, (Decimal, Vec<i32>, serde_json::Value)>(
        "SELECT monthly_budget, thresholds, team_overrides FROM budget_config WHERE id = 1",
    )
    .fetch_optional(pg)
    .await?;

    let (monthly_budget, thresholds, team_overrides) = match config {
        Some(c) => c,
        None => return Ok(()), // no budget configured
    };

    let thresholds = if thresholds.is_empty() {
        DEFAULT_THRESHOLDS.to_vec()
    } else {
        thresholds
    };

    // Current month spend
    let (current_spend,): (Option<Decimal>,) = sqlx::query_as(
        "SELECT SUM(total_cost) FROM daily_session_summary WHERE date >= date_trunc('month', NOW())",
    )
    .fetch_one(pg)
    .await?;

    let current_spend = current_spend.unwrap_or(Decimal::ZERO);
    let percent_used = if monthly_budget > Decimal::ZERO {
        (current_spend / monthly_budget * Decimal::from(100))
            .to_string()
            .parse::<f64>()
            .unwrap_or(0.0)
    } else {
        0.0
    };

    // Threshold alerts
    for threshold in &thresholds {
        let t = *threshold as f64;
        if percent_used >= t {
            let severity = match *threshold {
                x if x >= 100 => "error",
                x if x >= 75 => "warning",
                _ => "info",
            };

            let alert_id = format!("threshold-{}-{}", threshold, chrono::Utc::now().format("%Y%m"));
            upsert_alert(
                pg,
                &alert_id,
                "threshold_reached",
                severity,
                &format!("{}% of budget used", threshold),
                &format!(
                    "Organization has used {:.0}% of the ${} monthly budget (${:.2} spent)",
                    percent_used, monthly_budget, current_spend
                ),
                None,
            )
            .await?;
        }
    }

    // Per-team budget exceeded
    if let Some(overrides) = team_overrides.as_object() {
        let team_spends = sqlx::query_as::<_, (String, Decimal)>(
            "SELECT team_id, SUM(total_cost) FROM daily_session_summary
             WHERE date >= date_trunc('month', NOW())
             GROUP BY team_id",
        )
        .fetch_all(pg)
        .await?;

        for (team_id, spent) in &team_spends {
            if let Some(budget_val) = overrides.get(team_id).and_then(|v| v.as_f64()) {
                let team_budget = Decimal::try_from(budget_val).unwrap_or(Decimal::ZERO);
                if *spent > team_budget && team_budget > Decimal::ZERO {
                    let alert_id = format!("budget-exceeded-{}-{}", team_id, chrono::Utc::now().format("%Y%m"));
                    upsert_alert(
                        pg,
                        &alert_id,
                        "budget_exceeded",
                        "error",
                        &format!("Team budget exceeded"),
                        &format!(
                            "Team '{}' has spent ${:.2} exceeding budget of ${:.2}",
                            team_id, spent, team_budget
                        ),
                        Some(team_id),
                    )
                    .await?;
                }
            }
        }
    }

    // Spend spikes: daily spend > SPIKE_MULTIPLIER × 7-day average
    let team_daily_spends = sqlx::query_as::<_, (String, Decimal, Decimal)>(
        "WITH today_spend AS (
            SELECT team_id, SUM(total_cost) as today
            FROM daily_session_summary
            WHERE date = CURRENT_DATE
            GROUP BY team_id
        ),
        avg_spend AS (
            SELECT team_id, AVG(daily_total) as avg_daily
            FROM (
                SELECT team_id, date, SUM(total_cost) as daily_total
                FROM daily_session_summary
                WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND date < CURRENT_DATE
                GROUP BY team_id, date
            ) sub
            GROUP BY team_id
        )
        SELECT t.team_id, t.today, COALESCE(a.avg_daily, 0)
        FROM today_spend t
        LEFT JOIN avg_spend a ON a.team_id = t.team_id
        ORDER BY t.today DESC
        LIMIT $1",
    )
    .bind(SPIKE_CHECK_TEAM_LIMIT as i32)
    .fetch_all(pg)
    .await?;

    for (team_id, today, avg_daily) in &team_daily_spends {
        if *avg_daily > Decimal::ZERO && *today > *avg_daily * SPIKE_MULTIPLIER {
            let pct_above = ((*today - *avg_daily) / *avg_daily * Decimal::from(100))
                .to_string()
                .parse::<f64>()
                .unwrap_or(0.0);

            let alert_id = format!("spike-{}-{}", team_id, chrono::Utc::now().format("%Y%m%d"));
            upsert_alert(
                pg,
                &alert_id,
                "spend_spike",
                "warning",
                "Spend spike detected",
                &format!(
                    "Team '{}' daily spend is {:.0}% above 7-day average (${:.2} vs ${:.2} avg)",
                    team_id, pct_above, today, avg_daily
                ),
                Some(team_id),
            )
            .await?;
        }
    }

    // Trim to MAX_ALERTS
    sqlx::query(
        "DELETE FROM alerts_log WHERE id NOT IN (
            SELECT id FROM alerts_log ORDER BY ts DESC LIMIT $1
        )",
    )
    .bind(MAX_ALERTS as i32)
    .execute(pg)
    .await?;

    Ok(())
}

async fn upsert_alert(
    pg: &PgPool,
    id: &str,
    alert_type: &str,
    severity: &str,
    title: &str,
    description: &str,
    team_id: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO alerts_log (id, type, severity, title, description, team_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           severity = $3,
           title = $4,
           description = $5",
    )
    .bind(id)
    .bind(alert_type)
    .bind(severity)
    .bind(title)
    .bind(description)
    .bind(team_id)
    .execute(pg)
    .await?;
    Ok(())
}
