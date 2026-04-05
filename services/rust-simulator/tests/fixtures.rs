//! Deterministic test dataset.
//!
//! Generates a fixed, known dataset that all tests operate on.
//! Uses a seeded RNG so the data is identical across runs.
//! Add new test cases against this dataset as development progresses.

use chrono::{TimeZone, Utc};
use serde_json::json;
use zendash_simulator::models::events::KafkaEventMessage;
use zendash_simulator::models::team::{Team, User};

/// A complete test dataset with known, verifiable values.
pub struct TestDataset {
    pub teams: Vec<Team>,
    pub users: Vec<User>,
    /// A completed session with 2 iterations, 2 tool calls (both succeed)
    pub completed_session: Vec<KafkaEventMessage>,
    /// An errored session (tool error category) with 1 iteration
    pub errored_session_tool: Vec<KafkaEventMessage>,
    /// An errored session (api error category) dying on first iteration
    pub errored_session_api: Vec<KafkaEventMessage>,
    /// A cancelled session (truncated, 1 iteration)
    pub cancelled_session: Vec<KafkaEventMessage>,
    /// A session with multiple tool errors (some tools fail, session still completes)
    pub session_with_tool_errors: Vec<KafkaEventMessage>,
    /// A session using opus model (expensive)
    pub opus_session: Vec<KafkaEventMessage>,
    /// A session using haiku model (cheap)
    pub haiku_session: Vec<KafkaEventMessage>,
}

pub fn create_test_dataset() -> TestDataset {
    let teams = vec![
        Team { id: "backend".into(), name: "Backend".into() },
        Team { id: "frontend".into(), name: "Frontend".into() },
        Team { id: "ml".into(), name: "ML".into() },
    ];

    let users = vec![
        User { id: "user-1".into(), email: "alice.smith1@acme.com".into(), team_id: "backend".into() },
        User { id: "user-2".into(), email: "bob.jones2@acme.com".into(), team_id: "backend".into() },
        User { id: "user-3".into(), email: "carol.chen3@acme.com".into(), team_id: "frontend".into() },
        User { id: "user-4".into(), email: "dave.garcia4@acme.com".into(), team_id: "ml".into() },
    ];

    let base_ts = Utc.with_ymd_and_hms(2026, 4, 4, 10, 0, 0).unwrap();

    let completed_session = build_completed_session(base_ts);
    let errored_session_tool = build_errored_session_tool(base_ts);
    let errored_session_api = build_errored_session_api(base_ts);
    let cancelled_session = build_cancelled_session(base_ts);
    let session_with_tool_errors = build_session_with_tool_errors(base_ts);
    let opus_session = build_opus_session(base_ts);
    let haiku_session = build_haiku_session(base_ts);

    TestDataset {
        teams,
        users,
        completed_session,
        errored_session_tool,
        errored_session_api,
        cancelled_session,
        session_with_tool_errors,
        opus_session,
        haiku_session,
    }
}

/// Completed sonnet session: 2 iterations, read_file + edit_file, both succeed.
/// Known token values for verifiable cost calculation.
fn build_completed_session(base_ts: chrono::DateTime<Utc>) -> Vec<KafkaEventMessage> {
    let sid = "test-completed-1";
    let mut ts = base_ts;
    let mut events = vec![];

    // SessionStart
    events.push(msg(sid, 0, "SessionStart", json!({
        "userId": "user-1", "teamId": "backend", "model": "sonnet", "permissionLevel": "WorkspaceWrite"
    }), ts));

    // Iteration 1: TextDelta + ToolUse(read_file) + Usage + MessageStop + ToolResult
    ts = ts + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 1, "TextDelta", json!({"delta": "Let me read the file."}), ts));

    ts = ts + chrono::Duration::milliseconds(20);
    events.push(msg(sid, 2, "ToolUse", json!({
        "id": "t-1", "name": "read_file", "input": "{\"path\": \"src/main.rs\"}"
    }), ts));

    ts = ts + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 3, "Usage", json!({
        "inputTokens": 300, "outputTokens": 100, "cacheCreationInputTokens": 3000, "cacheReadInputTokens": 0
    }), ts));

    ts = ts + chrono::Duration::milliseconds(5);
    events.push(msg(sid, 4, "MessageStop", json!({}), ts));

    ts = ts + chrono::Duration::milliseconds(200);
    events.push(msg(sid, 5, "ToolResult", json!({
        "toolUseId": "t-1", "toolName": "read_file", "output": "fn main() {}", "isError": false
    }), ts));

    // Iteration 2: TextDelta + ToolUse(edit_file) + Usage + MessageStop + ToolResult
    ts = ts + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 6, "TextDelta", json!({"delta": "I'll fix the bug."}), ts));

    ts = ts + chrono::Duration::milliseconds(20);
    events.push(msg(sid, 7, "ToolUse", json!({
        "id": "t-2", "name": "edit_file", "input": "{\"path\": \"src/main.rs\", \"old_string\": \"old\", \"new_string\": \"new\"}"
    }), ts));

    ts = ts + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 8, "Usage", json!({
        "inputTokens": 500, "outputTokens": 150, "cacheCreationInputTokens": 0, "cacheReadInputTokens": 300
    }), ts));

    ts = ts + chrono::Duration::milliseconds(5);
    events.push(msg(sid, 9, "MessageStop", json!({}), ts));

    ts = ts + chrono::Duration::milliseconds(200);
    events.push(msg(sid, 10, "ToolResult", json!({
        "toolUseId": "t-2", "toolName": "edit_file", "output": "Successfully edited", "isError": false
    }), ts));

    // SessionEnd
    ts = ts + chrono::Duration::milliseconds(100);
    events.push(msg(sid, 11, "SessionEnd", json!({
        "status": "completed", "errorCode": null, "errorCategory": null, "durationMs": 670
    }), ts));

    events
}

/// Errored session (tool category): 1 iteration, bash fails, session dies.
fn build_errored_session_tool(base_ts: chrono::DateTime<Utc>) -> Vec<KafkaEventMessage> {
    let sid = "test-error-tool-1";
    let ts = base_ts + chrono::Duration::seconds(60);
    let mut events = vec![];
    let mut t = ts;

    events.push(msg(sid, 0, "SessionStart", json!({
        "userId": "user-2", "teamId": "backend", "model": "sonnet", "permissionLevel": "DangerFullAccess"
    }), t));

    t = t + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 1, "TextDelta", json!({"delta": "Running tests."}), t));

    t = t + chrono::Duration::milliseconds(20);
    events.push(msg(sid, 2, "ToolUse", json!({
        "id": "t-1", "name": "bash", "input": "{\"command\": \"npm test\"}"
    }), t));

    t = t + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 3, "Usage", json!({
        "inputTokens": 200, "outputTokens": 80, "cacheCreationInputTokens": 2500, "cacheReadInputTokens": 0
    }), t));

    t = t + chrono::Duration::milliseconds(5);
    events.push(msg(sid, 4, "MessageStop", json!({}), t));

    t = t + chrono::Duration::milliseconds(500);
    events.push(msg(sid, 5, "ToolResult", json!({
        "toolUseId": "t-1", "toolName": "bash", "output": "command not found: npm", "isError": true
    }), t));

    t = t + chrono::Duration::milliseconds(100);
    events.push(msg(sid, 6, "SessionEnd", json!({
        "status": "error", "errorCode": "TOOL_002", "errorCategory": "tool", "durationMs": 685
    }), t));

    events
}

/// Errored session (api category): dies immediately, no tool calls.
fn build_errored_session_api(base_ts: chrono::DateTime<Utc>) -> Vec<KafkaEventMessage> {
    let sid = "test-error-api-1";
    let ts = base_ts + chrono::Duration::seconds(120);
    let mut events = vec![];
    let mut t = ts;

    events.push(msg(sid, 0, "SessionStart", json!({
        "userId": "user-3", "teamId": "frontend", "model": "sonnet", "permissionLevel": "ReadOnly"
    }), t));

    // No iterations at all -- API error on first call
    t = t + chrono::Duration::milliseconds(500);
    events.push(msg(sid, 1, "SessionEnd", json!({
        "status": "error", "errorCode": "AUTH_001", "errorCategory": "api", "durationMs": 500
    }), t));

    events
}

/// Cancelled session: 1 iteration starts, user hits Ctrl+C.
fn build_cancelled_session(base_ts: chrono::DateTime<Utc>) -> Vec<KafkaEventMessage> {
    let sid = "test-cancelled-1";
    let ts = base_ts + chrono::Duration::seconds(180);
    let mut events = vec![];
    let mut t = ts;

    events.push(msg(sid, 0, "SessionStart", json!({
        "userId": "user-4", "teamId": "ml", "model": "opus", "permissionLevel": "WorkspaceWrite"
    }), t));

    t = t + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 1, "TextDelta", json!({"delta": "Analyzing data."}), t));

    t = t + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 2, "Usage", json!({
        "inputTokens": 400, "outputTokens": 200, "cacheCreationInputTokens": 4000, "cacheReadInputTokens": 0
    }), t));

    t = t + chrono::Duration::milliseconds(5);
    events.push(msg(sid, 3, "MessageStop", json!({}), t));

    t = t + chrono::Duration::milliseconds(100);
    events.push(msg(sid, 4, "SessionEnd", json!({
        "status": "cancelled", "errorCode": null, "errorCategory": null, "durationMs": 165
    }), t));

    events
}

/// Completed session where 2 out of 3 tool calls fail, but session still completes.
fn build_session_with_tool_errors(base_ts: chrono::DateTime<Utc>) -> Vec<KafkaEventMessage> {
    let sid = "test-tool-errors-1";
    let ts = base_ts + chrono::Duration::seconds(240);
    let mut events = vec![];
    let mut t = ts;

    events.push(msg(sid, 0, "SessionStart", json!({
        "userId": "user-1", "teamId": "backend", "model": "sonnet", "permissionLevel": "DangerFullAccess"
    }), t));

    // Iteration 1: 3 tools, 2 fail
    t = t + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 1, "TextDelta", json!({"delta": "Let me try several approaches."}), t));

    t = t + chrono::Duration::milliseconds(20);
    events.push(msg(sid, 2, "ToolUse", json!({"id": "t-1", "name": "bash", "input": "{\"command\": \"make build\"}"}), t));
    t = t + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 3, "ToolUse", json!({"id": "t-2", "name": "read_file", "input": "{\"path\": \"missing.rs\"}"}), t));
    t = t + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 4, "ToolUse", json!({"id": "t-3", "name": "grep_search", "input": "{\"pattern\": \"fn main\"}"}), t));

    t = t + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 5, "Usage", json!({
        "inputTokens": 350, "outputTokens": 180, "cacheCreationInputTokens": 3500, "cacheReadInputTokens": 0
    }), t));
    t = t + chrono::Duration::milliseconds(5);
    events.push(msg(sid, 6, "MessageStop", json!({}), t));

    // Tool results: bash fails, read_file fails, grep succeeds
    t = t + chrono::Duration::milliseconds(200);
    events.push(msg(sid, 7, "ToolResult", json!({
        "toolUseId": "t-1", "toolName": "bash", "output": "make: command not found", "isError": true
    }), t));
    t = t + chrono::Duration::milliseconds(100);
    events.push(msg(sid, 8, "ToolResult", json!({
        "toolUseId": "t-2", "toolName": "read_file", "output": "file not found", "isError": true
    }), t));
    t = t + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 9, "ToolResult", json!({
        "toolUseId": "t-3", "toolName": "grep_search", "output": "src/main.rs:1: fn main()", "isError": false
    }), t));

    // Session still completes
    t = t + chrono::Duration::milliseconds(100);
    events.push(msg(sid, 10, "SessionEnd", json!({
        "status": "completed", "errorCode": null, "errorCategory": null, "durationMs": 555
    }), t));

    events
}

/// Completed opus session for cost verification (expensive model).
fn build_opus_session(base_ts: chrono::DateTime<Utc>) -> Vec<KafkaEventMessage> {
    let sid = "test-opus-1";
    let ts = base_ts + chrono::Duration::seconds(300);
    let mut events = vec![];
    let mut t = ts;

    events.push(msg(sid, 0, "SessionStart", json!({
        "userId": "user-4", "teamId": "ml", "model": "opus", "permissionLevel": "ReadOnly"
    }), t));

    t = t + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 1, "TextDelta", json!({"delta": "Analyzing."}), t));

    t = t + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 2, "Usage", json!({
        "inputTokens": 500, "outputTokens": 300, "cacheCreationInputTokens": 0, "cacheReadInputTokens": 0
    }), t));

    t = t + chrono::Duration::milliseconds(5);
    events.push(msg(sid, 3, "MessageStop", json!({}), t));

    t = t + chrono::Duration::milliseconds(100);
    events.push(msg(sid, 4, "SessionEnd", json!({
        "status": "completed", "errorCode": null, "errorCategory": null, "durationMs": 165
    }), t));

    events
}

/// Completed haiku session for cost verification (cheapest model).
fn build_haiku_session(base_ts: chrono::DateTime<Utc>) -> Vec<KafkaEventMessage> {
    let sid = "test-haiku-1";
    let ts = base_ts + chrono::Duration::seconds(360);
    let mut events = vec![];
    let mut t = ts;

    events.push(msg(sid, 0, "SessionStart", json!({
        "userId": "user-3", "teamId": "frontend", "model": "haiku", "permissionLevel": "ReadOnly"
    }), t));

    t = t + chrono::Duration::milliseconds(50);
    events.push(msg(sid, 1, "TextDelta", json!({"delta": "Quick answer."}), t));

    t = t + chrono::Duration::milliseconds(10);
    events.push(msg(sid, 2, "Usage", json!({
        "inputTokens": 500, "outputTokens": 300, "cacheCreationInputTokens": 0, "cacheReadInputTokens": 0
    }), t));

    t = t + chrono::Duration::milliseconds(5);
    events.push(msg(sid, 3, "MessageStop", json!({}), t));

    t = t + chrono::Duration::milliseconds(100);
    events.push(msg(sid, 4, "SessionEnd", json!({
        "status": "completed", "errorCode": null, "errorCategory": null, "durationMs": 165
    }), t));

    events
}

fn msg(
    session_id: &str,
    seq: i32,
    event_type: &str,
    payload: serde_json::Value,
    ts: chrono::DateTime<Utc>,
) -> KafkaEventMessage {
    KafkaEventMessage {
        session_id: session_id.to_string(),
        seq,
        event_type: event_type.to_string(),
        payload,
        timestamp: ts,
    }
}
