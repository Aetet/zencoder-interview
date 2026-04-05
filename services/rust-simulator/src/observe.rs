use crate::db;

/// Print TimescaleDB statistics: event counts, session counts, date range, events/session breakdown.
pub async fn status() -> anyhow::Result<()> {
    let tsdb = db::timescale::connect_and_migrate().await?;

    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  TimescaleDB Status (raw events)                    ║");
    println!("╠══════════════════════════════════════════════════════╣");

    // Total events
    let (total_events,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM agent_events")
        .fetch_one(&tsdb).await?;
    println!("║  Total events:        {:>10}                    ║", total_events);

    // Unique sessions
    let (total_sessions,): (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT session_id) FROM agent_events"
    ).fetch_one(&tsdb).await?;
    println!("║  Unique sessions:     {:>10}                    ║", total_sessions);

    // Events per session (avg)
    if total_sessions > 0 {
        let avg = total_events as f64 / total_sessions as f64;
        println!("║  Avg events/session:  {:>10.1}                    ║", avg);
    }

    // Date range
    let range = sqlx::query_as::<_, (Option<chrono::DateTime<chrono::Utc>>, Option<chrono::DateTime<chrono::Utc>>)>(
        "SELECT MIN(ts), MAX(ts) FROM agent_events"
    ).fetch_one(&tsdb).await?;
    if let (Some(min_ts), Some(max_ts)) = range {
        println!("║  Date range:          {} → {}  ║", min_ts.format("%Y-%m-%d"), max_ts.format("%Y-%m-%d"));
    }

    // Event type breakdown
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Event Type Breakdown                               ║");
    println!("╠══════════════════════════════════════════════════════╣");
    let breakdown = sqlx::query_as::<_, (String, i64)>(
        "SELECT event_type, COUNT(*) AS cnt FROM agent_events GROUP BY event_type ORDER BY cnt DESC"
    ).fetch_all(&tsdb).await?;
    for (event_type, cnt) in &breakdown {
        println!("║  {:<22} {:>10}                    ║", event_type, cnt);
    }

    // Teams and users
    println!("╠══════════════════════════════════════════════════════╣");
    let (team_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM teams")
        .fetch_one(&tsdb).await?;
    let (user_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&tsdb).await?;
    println!("║  Teams:               {:>10}                    ║", team_count);
    println!("║  Users:               {:>10}                    ║", user_count);

    // Session status breakdown (from SessionEnd events)
    let statuses = sqlx::query_as::<_, (String, i64)>(
        "SELECT payload->>'status' AS status, COUNT(*) AS cnt
         FROM agent_events WHERE event_type = 'SessionEnd'
         GROUP BY payload->>'status' ORDER BY cnt DESC"
    ).fetch_all(&tsdb).await?;
    if !statuses.is_empty() {
        println!("╠══════════════════════════════════════════════════════╣");
        println!("║  Session Status                                     ║");
        println!("╠══════════════════════════════════════════════════════╣");
        for (status, cnt) in &statuses {
            println!("║  {:<22} {:>10}                    ║", status, cnt);
        }
    }

    println!("╚══════════════════════════════════════════════════════╝");

    Ok(())
}

/// Print Kafka topic statistics using rdkafka metadata API.
#[cfg(feature = "kafka")]
pub async fn kafka_monitor() -> anyhow::Result<()> {
    use rdkafka::config::ClientConfig;
    use rdkafka::consumer::{BaseConsumer, Consumer};
    use rdkafka::TopicPartitionList;
    use std::time::Duration;

    let brokers = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".into());
    let topic = std::env::var("KAFKA_TOPIC").unwrap_or_else(|_| "agent.events".into());
    let group_id = std::env::var("KAFKA_GROUP_ID").unwrap_or_else(|_| "zendash-transformer".into());

    let consumer: BaseConsumer = ClientConfig::new()
        .set("bootstrap.servers", &brokers)
        .set("group.id", &group_id)
        .create()?;

    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  Kafka Monitor                                      ║");
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Brokers:  {:<41} ║", brokers);
    println!("║  Topic:    {:<41} ║", topic);
    println!("║  Group:    {:<41} ║", group_id);

    // Fetch metadata
    let metadata = consumer.fetch_metadata(Some(&topic), Duration::from_secs(5))?;

    for topic_meta in metadata.topics() {
        let partitions = topic_meta.partitions();
        println!("╠══════════════════════════════════════════════════════╣");
        println!("║  Partitions: {:>10}                              ║", partitions.len());

        let mut total_messages: i64 = 0;
        let mut total_lag: i64 = 0;

        for partition in partitions {
            let pid = partition.id();

            // Get watermarks (low, high)
            let (low, high) = consumer.fetch_watermarks(&topic, pid, Duration::from_secs(5))?;
            let partition_messages = high - low;
            total_messages += partition_messages;

            // Get committed offset for this partition
            let mut tpl = TopicPartitionList::new();
            tpl.add_partition(&topic, pid);
            let committed = consumer.committed_offsets(tpl, Duration::from_secs(5))?;
            let committed_offset = committed.elements().first()
                .map(|e| e.offset().to_raw().unwrap_or(0))
                .unwrap_or(0);

            let lag = if committed_offset > 0 { high - committed_offset } else { partition_messages };
            total_lag += lag;

            println!("║  P{}: messages={:<8} committed={:<8} lag={:<6} ║", pid, partition_messages, committed_offset, lag);
        }

        println!("╠══════════════════════════════════════════════════════╣");
        println!("║  Total messages: {:>10}                         ║", total_messages);
        println!("║  Total lag:      {:>10}                         ║", total_lag);
    }

    println!("╚══════════════════════════════════════════════════════╝");

    Ok(())
}

#[cfg(not(feature = "kafka"))]
pub async fn kafka_monitor() -> anyhow::Result<()> {
    println!("Kafka monitoring requires the 'kafka' feature.");
    println!("Build with: cargo run --features kafka -- kafka-monitor");
    Ok(())
}

/// Print PostgreSQL baked table statistics: row counts, date ranges, sample aggregates.
pub async fn verify() -> anyhow::Result<()> {
    let pg = db::postgres::connect_and_migrate().await?;

    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  PostgreSQL Verify (baked tables)                   ║");
    println!("╠══════════════════════════════════════════════════════╣");

    // Table row counts
    let tables = [
        "teams", "users", "budget_config",
        "daily_session_summary", "daily_token_stats",
        "daily_quality_stats", "team_user_stats", "alerts_log",
    ];

    for table in &tables {
        let query = format!("SELECT COUNT(*) FROM {}", table);
        let (cnt,): (i64,) = sqlx::query_as(&query).fetch_one(&pg).await?;
        println!("║  {:<30} {:>10} rows   ║", table, cnt);
    }

    // Session summary totals
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Aggregated Metrics                                 ║");
    println!("╠══════════════════════════════════════════════════════╣");

    let agg = sqlx::query_as::<_, (i64, i64, i64, i64, rust_decimal::Decimal)>(
        "SELECT COALESCE(SUM(total_sessions),0), COALESCE(SUM(completed),0),
                COALESCE(SUM(errored),0), COALESCE(SUM(cancelled),0),
                COALESCE(SUM(total_cost),0)
         FROM daily_session_summary"
    ).fetch_one(&pg).await?;

    println!("║  Total sessions:      {:>10}                    ║", agg.0);
    println!("║  Completed:           {:>10}                    ║", agg.1);
    println!("║  Errored:             {:>10}                    ║", agg.2);
    println!("║  Cancelled:           {:>10}                    ║", agg.3);
    println!("║  Total cost:       ${:>12.2}                    ║", agg.4);

    if agg.0 > 0 {
        let rate = agg.1 as f64 / agg.0 as f64 * 100.0;
        println!("║  Completion rate:     {:>9.1}%                    ║", rate);
    }

    // Token totals
    let tokens = sqlx::query_as::<_, (i64, i64, i64, i64)>(
        "SELECT COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
                COALESCE(SUM(cache_creation),0), COALESCE(SUM(cache_read),0)
         FROM daily_token_stats"
    ).fetch_one(&pg).await?;

    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Token Totals                                       ║");
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Input tokens:        {:>10}                    ║", tokens.0);
    println!("║  Output tokens:       {:>10}                    ║", tokens.1);
    println!("║  Cache creation:      {:>10}                    ║", tokens.2);
    println!("║  Cache read:          {:>10}                    ║", tokens.3);

    if (tokens.2 + tokens.0) > 0 {
        let cache_rate = tokens.3 as f64 / (tokens.3 + tokens.0) as f64 * 100.0;
        println!("║  Cache hit rate:      {:>9.1}%                    ║", cache_rate);
    }

    // Quality
    let quality = sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64)>(
        "SELECT COALESCE(SUM(tool_calls),0), COALESCE(SUM(tool_errors),0),
                COALESCE(SUM(errors_api),0), COALESCE(SUM(errors_tool),0),
                COALESCE(SUM(errors_permission),0), COALESCE(SUM(errors_runtime),0)
         FROM daily_quality_stats"
    ).fetch_one(&pg).await?;

    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Quality Stats                                      ║");
    println!("╠══════════════════════════════════════════════════════╣");
    println!("║  Tool calls:          {:>10}                    ║", quality.0);
    println!("║  Tool errors:         {:>10}                    ║", quality.1);
    if quality.0 > 0 {
        println!("║  Tool error rate:     {:>9.1}%                    ║", quality.1 as f64 / quality.0 as f64 * 100.0);
    }
    println!("║  Error breakdown:                                   ║");
    println!("║    api:               {:>10}                    ║", quality.2);
    println!("║    tool:              {:>10}                    ║", quality.3);
    println!("║    permission:        {:>10}                    ║", quality.4);
    println!("║    runtime:           {:>10}                    ║", quality.5);

    // Date range
    let date_range = sqlx::query_as::<_, (Option<chrono::NaiveDate>, Option<chrono::NaiveDate>)>(
        "SELECT MIN(date), MAX(date) FROM daily_session_summary"
    ).fetch_one(&pg).await?;
    if let (Some(min_d), Some(max_d)) = date_range {
        println!("╠══════════════════════════════════════════════════════╣");
        println!("║  Date range: {} → {}                  ║", min_d, max_d);
    }

    // Budget config
    let budget = sqlx::query_as::<_, (rust_decimal::Decimal, Vec<i32>)>(
        "SELECT monthly_budget, thresholds FROM budget_config WHERE id = 1"
    ).fetch_optional(&pg).await?;
    if let Some((monthly, thresholds)) = budget {
        println!("╠══════════════════════════════════════════════════════╣");
        println!("║  Budget: ${}/month  thresholds: {:?}    ║", monthly, thresholds);
    }

    // Alerts
    let (alert_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM alerts_log")
        .fetch_one(&pg).await?;
    println!("║  Active alerts:       {:>10}                    ║", alert_count);

    println!("╚══════════════════════════════════════════════════════╝");

    Ok(())
}
