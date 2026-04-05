use std::collections::HashMap;

use sqlx::PgPool;
use tokio_stream::StreamExt;

use crate::kafka::consumer::EventConsumer;
use crate::models::events::KafkaEventMessage;
use crate::transformer::aggregator;
use crate::transformer::alerts;

/// Buffer events per session, aggregate on SessionEnd.
pub async fn run(consumer: EventConsumer, pg: &PgPool) -> anyhow::Result<()> {
    let mut session_buffers: HashMap<String, Vec<KafkaEventMessage>> = HashMap::new();
    let mut processed = 0u64;

    tracing::info!("transformer started, consuming events...");

    let mut stream = std::pin::pin!(consumer.stream());

    while let Some(result) = stream.next().await {
        let event = match result {
            Ok(e) => e,
            Err(e) => {
                tracing::error!("event parse error: {}", e);
                continue;
            }
        };

        let session_id = event.session_id.clone();
        let is_session_end = event.event_type == "SessionEnd";

        session_buffers
            .entry(session_id.clone())
            .or_default()
            .push(event);

        if is_session_end {
            if let Some(events) = session_buffers.remove(&session_id) {
                if let Err(e) = aggregator::process_session(pg, &events).await {
                    tracing::error!("failed to process session {}: {}", session_id, e);
                }

                processed += 1;
                if processed % 1000 == 0 {
                    tracing::info!("processed {} sessions", processed);

                    // Periodically generate alerts
                    if let Err(e) = alerts::generate_alerts(pg).await {
                        tracing::error!("alert generation error: {}", e);
                    }
                }
            }
        }
    }

    Ok(())
}
