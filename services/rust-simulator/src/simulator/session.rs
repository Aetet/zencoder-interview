use chrono::{Duration, Utc};
use rand::Rng;
use serde_json::json;

use crate::models::events::{
    AgentEvent, EventType, SessionEndPayload, SessionStartPayload, TextDeltaPayload,
    ToolResultPayload, ToolUsePayload, UsagePayload,
};
use crate::models::team::User;

/// Tool names with weights matching real-world agent usage
const TOOLS: &[(&str, u32)] = &[
    ("read_file", 30),
    ("bash", 20),
    ("edit_file", 15),
    ("grep_search", 12),
    ("glob_search", 8),
    ("write_file", 5),
    ("WebFetch", 3),
    ("WebSearch", 2),
    ("TodoWrite", 2),
    ("Agent", 1),
    ("NotebookEdit", 1),
    ("Skill", 1),
];

/// Models with weights: haiku 60%, sonnet 30%, opus 10%
const MODELS: &[(&str, u32)] = &[("haiku", 60), ("sonnet", 30), ("opus", 10)];

/// Session status: completed 85%, error 10%, cancelled 5%
const STATUSES: &[(&str, u32)] = &[("completed", 85), ("error", 10), ("cancelled", 5)];

/// Error categories for errored sessions: api 40%, tool 30%, permission 15%, runtime 15%
const ERROR_CATEGORIES: &[(&str, u32)] = &[
    ("api", 40),
    ("tool", 30),
    ("permission", 15),
    ("runtime", 15),
];

/// Specific error codes per category
const API_ERRORS: &[&str] = &["AUTH_001", "AUTH_002", "AUTH_003", "NET_001", "NET_002", "NET_003"];
const TOOL_ERRORS: &[&str] = &["TOOL_001", "TOOL_002"];
const PERMISSION_ERRORS: &[&str] = &["PERM_001", "PERM_002", "PERM_003"];
const RUNTIME_ERRORS: &[&str] = &["RUNTIME_001", "RUNTIME_002", "RUNTIME_003"];

/// Permission levels
const PERMISSION_LEVELS: &[&str] = &["ReadOnly", "WorkspaceWrite", "DangerFullAccess"];

fn weighted_pick<'a>(items: &[(&'a str, u32)], rng: &mut impl Rng) -> &'a str {
    let total: u32 = items.iter().map(|(_, w)| w).sum();
    let mut r = rng.gen_range(0..total);
    for (item, weight) in items {
        if r < *weight {
            return item;
        }
        r -= weight;
    }
    items.last().unwrap().0
}

fn pick_error_code(category: &str, rng: &mut impl Rng) -> &'static str {
    let codes = match category {
        "api" => API_ERRORS,
        "tool" => TOOL_ERRORS,
        "permission" => PERMISSION_ERRORS,
        "runtime" => RUNTIME_ERRORS,
        _ => API_ERRORS,
    };
    codes[rng.gen_range(0..codes.len())]
}

/// Generate all sessions for a single day.
/// Returns a Vec of session event sequences (each session is a Vec<AgentEvent>).
pub fn generate_day_sessions(
    users: &[User],
    days_ago: u32,
    sessions_per_day: u32,
) -> Vec<Vec<AgentEvent>> {
    let mut rng = rand::thread_rng();
    let day_count = (sessions_per_day as i32 + rng.gen_range(-20..=20)).max(1) as u32;

    let now = Utc::now();
    let base_date = now - Duration::days(days_ago as i64);

    let mut sessions = Vec::with_capacity(day_count as usize);

    for _ in 0..day_count {
        let user = &users[rng.gen_range(0..users.len())];
        let model = weighted_pick(MODELS, &mut rng);
        let status = weighted_pick(STATUSES, &mut rng);

        let hour = rng.gen_range(8..=20);
        let minute = rng.gen_range(0..60);
        let second = rng.gen_range(0..60);
        let session_start = base_date
            .date_naive()
            .and_hms_opt(hour, minute, second)
            .unwrap()
            .and_utc();

        let session_id = format!("sess-{}", uuid::Uuid::new_v4().as_simple());

        let events = generate_session_events(
            &session_id,
            user,
            model,
            status,
            session_start,
            &mut rng,
        );
        sessions.push(events);
    }

    sessions
}

/// Generate the full streaming event sequence for one session.
fn generate_session_events(
    session_id: &str,
    user: &User,
    model: &str,
    status: &str,
    start_time: chrono::DateTime<Utc>,
    rng: &mut impl Rng,
) -> Vec<AgentEvent> {
    let mut events = Vec::new();
    let mut seq = 0i32;
    let mut ts = start_time;

    let permission_level = PERMISSION_LEVELS[rng.gen_range(0..PERMISSION_LEVELS.len())];

    // Decide session shape
    let planned_iterations = match status {
        // Error sessions: runtime errors have many iterations, others fewer
        "error" => {
            let cat = weighted_pick(ERROR_CATEGORIES, rng);
            if cat == "runtime" {
                rng.gen_range(5..=6) // max iterations error
            } else {
                rng.gen_range(1..=3) // dies early
            }
        }
        "cancelled" => rng.gen_range(1..=3), // truncated
        _ => weighted_iteration_count(rng),   // normal: 1-6 weighted toward 2-3
    };

    // SessionStart
    let start_payload = SessionStartPayload {
        user_id: user.id.clone(),
        team_id: user.team_id.clone(),
        model: model.to_string(),
        permission_level: permission_level.to_string(),
    };
    events.push(AgentEvent {
        session_id: session_id.to_string(),
        seq,
        event_type: EventType::SessionStart,
        payload: serde_json::to_value(&start_payload).unwrap(),
        ts,
    });
    seq += 1;
    ts = ts + Duration::milliseconds(rng.gen_range(10..100));

    // Track cumulative tokens for realistic cache behavior
    let mut prev_input_tokens = 0i64;
    let mut tool_id_counter = 0u32;

    // Generate iterations
    for iteration in 0..planned_iterations {
        // TextDelta events (1-3 chunks)
        let text_chunks = rng.gen_range(1..=3);
        for _ in 0..text_chunks {
            let delta = format!("Agent response chunk for iteration {}.", iteration + 1);
            events.push(AgentEvent {
                session_id: session_id.to_string(),
                seq,
                event_type: EventType::TextDelta,
                payload: serde_json::to_value(TextDeltaPayload { delta }).unwrap(),
                ts,
            });
            seq += 1;
            ts = ts + Duration::milliseconds(rng.gen_range(5..50));
        }

        // ToolUse events (0-3 per iteration, weighted toward 1)
        let tools_count = weighted_tool_count(rng);
        let mut iteration_tools: Vec<(String, String)> = Vec::new(); // (tool_id, tool_name)

        for _ in 0..tools_count {
            tool_id_counter += 1;
            let tool_id = format!("t-{}", tool_id_counter);
            let tool_name = weighted_pick(TOOLS, rng).to_string();
            let tool_input = generate_tool_input(&tool_name, rng);

            events.push(AgentEvent {
                session_id: session_id.to_string(),
                seq,
                event_type: EventType::ToolUse,
                payload: serde_json::to_value(ToolUsePayload {
                    id: tool_id.clone(),
                    name: tool_name.clone(),
                    input: tool_input,
                })
                .unwrap(),
                ts,
            });
            seq += 1;
            ts = ts + Duration::milliseconds(rng.gen_range(5..30));
            iteration_tools.push((tool_id, tool_name));
        }

        // Usage event (one per iteration)
        let input_tokens = if iteration == 0 {
            rng.gen_range(150..=400)
        } else {
            // Context grows: previous input + output + tool results
            prev_input_tokens + rng.gen_range(50..200)
        };
        let output_tokens = rng.gen_range(30..=400);
        let cache_creation = if iteration == 0 {
            rng.gen_range(2000..=5000)
        } else {
            0
        };
        let cache_read = if iteration == 0 {
            0
        } else {
            prev_input_tokens.min(rng.gen_range(100..=800))
        };

        events.push(AgentEvent {
            session_id: session_id.to_string(),
            seq,
            event_type: EventType::Usage,
            payload: serde_json::to_value(UsagePayload {
                input_tokens,
                output_tokens,
                cache_creation_input_tokens: cache_creation,
                cache_read_input_tokens: cache_read,
            })
            .unwrap(),
            ts,
        });
        seq += 1;
        ts = ts + Duration::milliseconds(rng.gen_range(5..20));

        prev_input_tokens = input_tokens;

        // MessageStop
        events.push(AgentEvent {
            session_id: session_id.to_string(),
            seq,
            event_type: EventType::MessageStop,
            payload: json!({}),
            ts,
        });
        seq += 1;
        ts = ts + Duration::milliseconds(rng.gen_range(100..2000)); // tool execution time

        // ToolResult events for each tool used
        for (tool_id, tool_name) in &iteration_tools {
            let is_error = rng.gen_ratio(1, 10); // 10% tool error rate
            let output = if is_error {
                generate_tool_error_output(&tool_name, rng)
            } else {
                generate_tool_success_output(&tool_name, rng)
            };

            events.push(AgentEvent {
                session_id: session_id.to_string(),
                seq,
                event_type: EventType::ToolResult,
                payload: serde_json::to_value(ToolResultPayload {
                    tool_use_id: tool_id.clone(),
                    tool_name: tool_name.clone(),
                    output,
                    is_error,
                })
                .unwrap(),
                ts,
            });
            seq += 1;
            ts = ts + Duration::milliseconds(rng.gen_range(50..500));
        }
    }

    // SessionEnd
    let duration_ms = (ts - start_time).num_milliseconds().max(5000);

    let (error_code, error_category) = if status == "error" {
        let category = weighted_pick(ERROR_CATEGORIES, rng);
        let code = pick_error_code(category, rng);
        (Some(code.to_string()), Some(category.to_string()))
    } else {
        (None, None)
    };

    events.push(AgentEvent {
        session_id: session_id.to_string(),
        seq,
        event_type: EventType::SessionEnd,
        payload: serde_json::to_value(SessionEndPayload {
            status: status.to_string(),
            error_code,
            error_category,
            duration_ms,
        })
        .unwrap(),
        ts,
    });

    events
}

/// Weighted iteration count: 1-6, most common 2-3
fn weighted_iteration_count(rng: &mut impl Rng) -> u32 {
    let weights: &[(u32, u32)] = &[(1, 15), (2, 30), (3, 25), (4, 15), (5, 10), (6, 5)];
    let total: u32 = weights.iter().map(|(_, w)| w).sum();
    let mut r = rng.gen_range(0..total);
    for (count, weight) in weights {
        if r < *weight {
            return *count;
        }
        r -= weight;
    }
    3
}

/// Weighted tool count per iteration: 0-3, most common 1
fn weighted_tool_count(rng: &mut impl Rng) -> u32 {
    let weights: &[(u32, u32)] = &[(0, 15), (1, 45), (2, 25), (3, 15)];
    let total: u32 = weights.iter().map(|(_, w)| w).sum();
    let mut r = rng.gen_range(0..total);
    for (count, weight) in weights {
        if r < *weight {
            return *count;
        }
        r -= weight;
    }
    1
}

fn generate_tool_input(tool_name: &str, rng: &mut impl Rng) -> String {
    match tool_name {
        "bash" => {
            let commands = ["cargo test", "npm run build", "git status", "ls -la src/", "grep -r TODO ."];
            let cmd = commands[rng.gen_range(0..commands.len())];
            format!(r#"{{"command": "{}"}}"#, cmd)
        }
        "read_file" => {
            let paths = ["src/main.rs", "src/lib.rs", "src/config.rs", "tests/integration.rs", "README.md"];
            let path = paths[rng.gen_range(0..paths.len())];
            format!(r#"{{"path": "{}"}}"#, path)
        }
        "edit_file" => {
            format!(r#"{{"path": "src/handler.rs", "old_string": "fn old()", "new_string": "fn new()"}}"#)
        }
        "write_file" => {
            format!(r#"{{"path": "src/new_module.rs", "content": "pub fn init() {{}}"}}"#)
        }
        "grep_search" => {
            let patterns = ["fn main", "TODO", "impl Error", "pub struct", "async fn"];
            let pat = patterns[rng.gen_range(0..patterns.len())];
            format!(r#"{{"pattern": "{}"}}"#, pat)
        }
        "glob_search" => {
            let patterns = ["**/*.rs", "src/**/*.ts", "tests/**/*", "*.toml"];
            let pat = patterns[rng.gen_range(0..patterns.len())];
            format!(r#"{{"pattern": "{}"}}"#, pat)
        }
        "WebFetch" => {
            format!(r#"{{"url": "https://docs.rs/tokio/latest", "prompt": "async runtime docs"}}"#)
        }
        "WebSearch" => {
            format!(r#"{{"query": "rust error handling best practices"}}"#)
        }
        _ => r#"{}"#.to_string(),
    }
}

fn generate_tool_success_output(tool_name: &str, _rng: &mut impl Rng) -> String {
    match tool_name {
        "bash" => "exit code: 0\nAll tests passed.".to_string(),
        "read_file" => "fn main() {\n    println!(\"hello\");\n}".to_string(),
        "edit_file" => "Successfully edited src/handler.rs".to_string(),
        "write_file" => "Created src/new_module.rs (42 bytes)".to_string(),
        "grep_search" => "src/main.rs:1: fn main() {".to_string(),
        "glob_search" => "src/main.rs\nsrc/lib.rs\nsrc/config.rs".to_string(),
        "WebFetch" => "Fetched docs page (2.1KB)".to_string(),
        "WebSearch" => "Found 5 results for query".to_string(),
        _ => "Success".to_string(),
    }
}

fn generate_tool_error_output(tool_name: &str, _rng: &mut impl Rng) -> String {
    match tool_name {
        "bash" => "exit code: 1\ncommand not found: npm".to_string(),
        "read_file" => "Error: file not found: src/missing.rs".to_string(),
        "edit_file" => "Error: old_string not found in file".to_string(),
        "write_file" => "Error: directory does not exist: src/missing_dir/".to_string(),
        "grep_search" => "Error: invalid regex pattern".to_string(),
        _ => "Error: execution failed".to_string(),
    }
}
