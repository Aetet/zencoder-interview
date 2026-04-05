use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A single streaming event from the agent runtime.
/// Stored as one row in the `agent_events` hypertable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEvent {
    pub session_id: String,
    pub seq: i32,
    pub event_type: EventType,
    pub payload: serde_json::Value,
    pub ts: DateTime<Utc>,
}

/// Discriminator for the event payload.
/// Matches the reference agent's AssistantEvent enum + our extensions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventType {
    SessionStart,
    TextDelta,
    ToolUse,
    ToolResult,
    Usage,
    MessageStop,
    SessionEnd,
}

impl EventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SessionStart => "SessionStart",
            Self::TextDelta => "TextDelta",
            Self::ToolUse => "ToolUse",
            Self::ToolResult => "ToolResult",
            Self::Usage => "Usage",
            Self::MessageStop => "MessageStop",
            Self::SessionEnd => "SessionEnd",
        }
    }
}

impl std::fmt::Display for EventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// --- Payload structs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStartPayload {
    pub user_id: String,
    pub team_id: String,
    pub model: String,
    pub permission_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDeltaPayload {
    pub delta: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolUsePayload {
    pub id: String,
    pub name: String,
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResultPayload {
    pub tool_use_id: String,
    pub tool_name: String,
    pub output: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsagePayload {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_creation_input_tokens: i64,
    pub cache_read_input_tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEndPayload {
    pub status: String,
    pub error_code: Option<String>,
    pub error_category: Option<String>,
    pub duration_ms: i64,
}

// --- Kafka message envelope ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KafkaEventMessage {
    pub session_id: String,
    pub seq: i32,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

impl From<&AgentEvent> for KafkaEventMessage {
    fn from(event: &AgentEvent) -> Self {
        Self {
            session_id: event.session_id.clone(),
            seq: event.seq,
            event_type: event.event_type.as_str().to_string(),
            payload: event.payload.clone(),
            timestamp: event.ts,
        }
    }
}
