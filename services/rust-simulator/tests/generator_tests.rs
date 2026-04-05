//! Tests for the generator and session event sequence generator.
//!
//! Verifies that generated data has correct structure, valid distributions,
//! and well-formed event sequences. Uses the real generator code -- no mocks.

use std::collections::HashSet;
use zendash_simulator::models::events::EventType;
use zendash_simulator::simulator::generator;
use zendash_simulator::simulator::session;

// ─── Team generation ─────────────────────────────────────────────────

#[test]
fn generates_requested_number_of_teams() {
    let teams = generator::generate_teams(100);
    assert_eq!(teams.len(), 100);
}

#[test]
fn generates_1000_teams_without_duplicates() {
    let teams = generator::generate_teams(1000);
    assert_eq!(teams.len(), 1000);

    let ids: HashSet<_> = teams.iter().map(|t| &t.id).collect();
    assert_eq!(ids.len(), 1000, "team IDs must be unique");

    let names: HashSet<_> = teams.iter().map(|t| &t.name).collect();
    assert_eq!(names.len(), 1000, "team names must be unique");
}

#[test]
fn team_id_is_lowercase_hyphenated_name() {
    let teams = generator::generate_teams(5);
    for team in &teams {
        assert_eq!(team.id, team.name.to_lowercase().replace(' ', "-"));
    }
}

#[test]
fn first_teams_use_prefixes_directly() {
    let teams = generator::generate_teams(3);
    assert_eq!(teams[0].name, "Backend");
    assert_eq!(teams[1].name, "Frontend");
    assert_eq!(teams[2].name, "Platform");
}

// ─── User generation ─────────────────────────────────────────────────

#[test]
fn generates_2_to_5_users_per_team() {
    let teams = generator::generate_teams(50);
    let users = generator::generate_users(&teams);

    let mut team_user_counts = std::collections::HashMap::new();
    for user in &users {
        *team_user_counts.entry(&user.team_id).or_insert(0) += 1;
    }

    for (_team_id, count) in &team_user_counts {
        assert!(
            *count >= 2 && *count <= 5,
            "team should have 2-5 users, got {}",
            count
        );
    }
}

#[test]
fn every_user_belongs_to_existing_team() {
    let teams = generator::generate_teams(20);
    let team_ids: HashSet<_> = teams.iter().map(|t| &t.id).collect();
    let users = generator::generate_users(&teams);

    for user in &users {
        assert!(
            team_ids.contains(&user.team_id),
            "user {} has invalid team_id {}",
            user.id,
            user.team_id
        );
    }
}

#[test]
fn user_ids_are_sequential() {
    let teams = generator::generate_teams(5);
    let users = generator::generate_users(&teams);

    for (i, user) in users.iter().enumerate() {
        assert_eq!(user.id, format!("user-{}", i + 1));
    }
}

#[test]
fn user_emails_follow_pattern() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);

    for user in &users {
        assert!(user.email.ends_with("@acme.com"), "email: {}", user.email);
        assert!(user.email.contains('.'), "email should have dot: {}", user.email);
    }
}

// ─── Session event sequence structure ────────────────────────────────

#[test]
fn session_starts_with_session_start_and_ends_with_session_end() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 10);

    for events in &day_sessions {
        assert!(!events.is_empty(), "session should not be empty");

        assert_eq!(
            events.first().unwrap().event_type,
            EventType::SessionStart,
            "first event must be SessionStart"
        );
        assert_eq!(
            events.last().unwrap().event_type,
            EventType::SessionEnd,
            "last event must be SessionEnd"
        );
    }
}

#[test]
fn session_events_have_monotonically_increasing_seq() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 20);

    for events in &day_sessions {
        for (i, event) in events.iter().enumerate() {
            assert_eq!(
                event.seq, i as i32,
                "seq should be {}, got {} in session {}",
                i, event.seq, event.session_id
            );
        }
    }
}

#[test]
fn session_events_have_monotonically_increasing_timestamps() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 20);

    for events in &day_sessions {
        for window in events.windows(2) {
            assert!(
                window[1].ts >= window[0].ts,
                "timestamps must be non-decreasing: {} >= {} in session {}",
                window[1].ts,
                window[0].ts,
                window[0].session_id
            );
        }
    }
}

#[test]
fn all_events_in_session_share_same_session_id() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 10);

    for events in &day_sessions {
        let sid = &events[0].session_id;
        for event in events {
            assert_eq!(&event.session_id, sid);
        }
    }
}

#[test]
fn session_ids_are_unique_across_sessions() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 50);

    let ids: HashSet<_> = day_sessions.iter().map(|s| &s[0].session_id).collect();
    assert_eq!(ids.len(), day_sessions.len(), "session IDs must be unique");
}

// ─── Event type ordering rules ───────────────────────────────────────

#[test]
fn every_tool_use_has_a_matching_tool_result() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 50);

    for events in &day_sessions {
        let tool_use_ids: HashSet<String> = events
            .iter()
            .filter(|e| e.event_type == EventType::ToolUse)
            .map(|e| e.payload["id"].as_str().unwrap().to_string())
            .collect();

        let tool_result_ids: HashSet<String> = events
            .iter()
            .filter(|e| e.event_type == EventType::ToolResult)
            .map(|e| e.payload["toolUseId"].as_str().unwrap().to_string())
            .collect();

        assert_eq!(
            tool_use_ids, tool_result_ids,
            "every ToolUse must have a matching ToolResult in session {}",
            events[0].session_id
        );
    }
}

#[test]
fn usage_events_equal_message_stop_events() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 50);

    for events in &day_sessions {
        let usage_count = events.iter().filter(|e| e.event_type == EventType::Usage).count();
        let stop_count = events.iter().filter(|e| e.event_type == EventType::MessageStop).count();

        assert_eq!(
            usage_count, stop_count,
            "Usage events ({}) must equal MessageStop events ({}) in session {}",
            usage_count, stop_count, events[0].session_id
        );
    }
}

#[test]
fn tool_results_come_after_message_stop() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 50);

    for events in &day_sessions {
        let mut last_message_stop_seq = -1i32;

        for event in events {
            if event.event_type == EventType::MessageStop {
                last_message_stop_seq = event.seq;
            }
            if event.event_type == EventType::ToolResult {
                assert!(
                    event.seq > last_message_stop_seq,
                    "ToolResult (seq {}) must come after MessageStop (seq {}) in session {}",
                    event.seq, last_message_stop_seq, events[0].session_id
                );
            }
        }
    }
}

// ─── Cache behavior pattern ──────────────────────────────────────────

#[test]
fn first_iteration_has_cache_creation_and_no_cache_read() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 30);

    for events in &day_sessions {
        let usage_events: Vec<_> = events
            .iter()
            .filter(|e| e.event_type == EventType::Usage)
            .collect();

        if let Some(first_usage) = usage_events.first() {
            let cache_creation = first_usage.payload["cacheCreationInputTokens"]
                .as_i64()
                .unwrap_or(0);
            let cache_read = first_usage.payload["cacheReadInputTokens"]
                .as_i64()
                .unwrap_or(0);

            assert!(
                cache_creation > 0,
                "first iteration should have cacheCreation > 0, got {} in session {}",
                cache_creation, events[0].session_id
            );
            assert_eq!(
                cache_read, 0,
                "first iteration should have cacheRead = 0, got {} in session {}",
                cache_read, events[0].session_id
            );
        }
    }
}

#[test]
fn subsequent_iterations_have_zero_cache_creation() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 50);

    for events in &day_sessions {
        let usage_events: Vec<_> = events
            .iter()
            .filter(|e| e.event_type == EventType::Usage)
            .collect();

        for usage in usage_events.iter().skip(1) {
            let cache_creation = usage.payload["cacheCreationInputTokens"]
                .as_i64()
                .unwrap_or(0);
            assert_eq!(
                cache_creation, 0,
                "iterations after first should have cacheCreation = 0, got {} in session {}",
                cache_creation, events[0].session_id
            );
        }
    }
}

// ─── Session payload validation ──────────────────────────────────────

#[test]
fn session_start_has_required_fields() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 20);

    for events in &day_sessions {
        let start = &events[0];
        assert!(start.payload["userId"].is_string());
        assert!(start.payload["teamId"].is_string());
        assert!(start.payload["model"].is_string());
        assert!(start.payload["permissionLevel"].is_string());

        let model = start.payload["model"].as_str().unwrap();
        assert!(
            ["haiku", "sonnet", "opus"].contains(&model),
            "invalid model: {}",
            model
        );

        let perm = start.payload["permissionLevel"].as_str().unwrap();
        assert!(
            ["ReadOnly", "WorkspaceWrite", "DangerFullAccess"].contains(&perm),
            "invalid permission: {}",
            perm
        );
    }
}

#[test]
fn session_end_has_required_fields() {
    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 20);

    for events in &day_sessions {
        let end = events.last().unwrap();
        let status = end.payload["status"].as_str().unwrap();
        assert!(
            ["completed", "error", "cancelled"].contains(&status),
            "invalid status: {}",
            status
        );

        if status == "error" {
            assert!(
                end.payload["errorCode"].is_string(),
                "errored session must have errorCode"
            );
            let category = end.payload["errorCategory"].as_str().unwrap();
            assert!(
                ["api", "tool", "permission", "runtime"].contains(&category),
                "invalid error category: {}",
                category
            );
        }

        assert!(end.payload["durationMs"].is_i64());
        assert!(end.payload["durationMs"].as_i64().unwrap() > 0);
    }
}

#[test]
fn tool_use_payloads_have_valid_tool_names() {
    let valid_tools: HashSet<&str> = [
        "read_file", "bash", "edit_file", "grep_search", "glob_search",
        "write_file", "WebFetch", "WebSearch", "TodoWrite", "Agent",
        "NotebookEdit", "Skill",
    ]
    .into_iter()
    .collect();

    let teams = generator::generate_teams(3);
    let users = generator::generate_users(&teams);
    let day_sessions = session::generate_day_sessions(&users, 0, 50);

    for events in &day_sessions {
        for event in events.iter().filter(|e| e.event_type == EventType::ToolUse) {
            let name = event.payload["name"].as_str().unwrap();
            assert!(
                valid_tools.contains(name),
                "invalid tool name: {} in session {}",
                name, event.session_id
            );
            assert!(event.payload["id"].is_string());
            assert!(event.payload["input"].is_string());
        }
    }
}

// ─── Day generation ──────────────────────────────────────────────────

#[test]
fn generates_approximately_requested_sessions_per_day() {
    let teams = generator::generate_teams(10);
    let users = generator::generate_users(&teams);

    // Run multiple days to check range
    for day in 0..5 {
        let sessions = session::generate_day_sessions(&users, day, 300);
        let count = sessions.len();
        assert!(
            count >= 280 && count <= 320,
            "day {} generated {} sessions, expected 280-320",
            day,
            count
        );
    }
}
