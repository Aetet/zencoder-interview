use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::time::Duration;

use crate::models::events::{AgentEvent, KafkaEventMessage};

pub struct EventProducer {
    producer: FutureProducer,
    topic: String,
}

impl EventProducer {
    pub fn new() -> anyhow::Result<Self> {
        let brokers =
            std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".into());
        let topic =
            std::env::var("KAFKA_TOPIC").unwrap_or_else(|_| "agent.events".into());

        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", &brokers)
            .set("message.timeout.ms", "5000")
            .create()?;

        Ok(Self { producer, topic })
    }

    pub async fn send(&self, event: &AgentEvent) -> anyhow::Result<()> {
        let message = KafkaEventMessage::from(event);
        let payload = serde_json::to_string(&message)?;
        let key = &event.session_id;

        self.producer
            .send(
                FutureRecord::to(&self.topic)
                    .key(key)
                    .payload(&payload),
                Duration::from_secs(5),
            )
            .await
            .map_err(|(e, _)| anyhow::anyhow!("kafka send error: {}", e))?;

        Ok(())
    }

    pub async fn send_batch(&self, events: &[AgentEvent]) -> anyhow::Result<()> {
        for event in events {
            self.send(event).await?;
        }
        Ok(())
    }
}
