use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::Message;
use tokio_stream::StreamExt;

use crate::models::events::KafkaEventMessage;

pub struct EventConsumer {
    consumer: StreamConsumer,
}

impl EventConsumer {
    pub fn new() -> anyhow::Result<Self> {
        let brokers =
            std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".into());
        let topic =
            std::env::var("KAFKA_TOPIC").unwrap_or_else(|_| "agent.events".into());
        let group_id =
            std::env::var("KAFKA_GROUP_ID").unwrap_or_else(|_| "zendash-transformer".into());

        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", &brokers)
            .set("group.id", &group_id)
            .set("auto.offset.reset", "earliest")
            .set("enable.auto.commit", "true")
            .create()?;

        consumer.subscribe(&[&topic])?;

        Ok(Self { consumer })
    }

    /// Returns the next event from the stream, or None if the stream ends.
    pub async fn next_event(&self) -> Option<anyhow::Result<KafkaEventMessage>> {
        let mut stream = self.consumer.stream();

        loop {
            match stream.next().await {
                Some(Ok(msg)) => {
                    if let Some(payload) = msg.payload() {
                        match serde_json::from_slice::<KafkaEventMessage>(payload) {
                            Ok(event) => return Some(Ok(event)),
                            Err(e) => return Some(Err(e.into())),
                        }
                    }
                    // No payload, skip
                }
                Some(Err(e)) => {
                    tracing::error!("kafka consume error: {}", e);
                }
                None => return None,
            }
        }
    }

    /// Stream events continuously, yielding each one.
    pub fn stream(&self) -> impl tokio_stream::Stream<Item = anyhow::Result<KafkaEventMessage>> + '_ {
        async_stream::stream! {
            let mut stream = self.consumer.stream();

            while let Some(result) = stream.next().await {
                match result {
                    Ok(msg) => {
                        if let Some(payload) = msg.payload() {
                            match serde_json::from_slice::<KafkaEventMessage>(payload) {
                                Ok(event) => yield Ok(event),
                                Err(e) => yield Err(e.into()),
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("kafka consume error: {}", e);
                    }
                }
            }
        }
    }
}
