//! Tests for the aggregation pipeline.
//!
//! Verifies that streaming agent events are correctly aggregated into
//! session-level metrics. Uses the deterministic test dataset -- no mocks,
//! no database, pure computation verification.

mod fixtures;

use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use zendash_simulator::models::pricing;
use zendash_simulator::transformer::aggregator::aggregate_session_events;

// ─── Token aggregation ────────────────────────────────────────────────

#[test]
fn completed_session_sums_tokens_across_iterations() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.completed_session).unwrap();

    // Iteration 1: input=300, output=100, cache_create=3000, cache_read=0
    // Iteration 2: input=500, output=150, cache_create=0,    cache_read=300
    assert_eq!(m.input_tokens, 800);
    assert_eq!(m.output_tokens, 250);
    assert_eq!(m.cache_creation, 3000);
    assert_eq!(m.cache_read, 300);
}

#[test]
fn errored_session_with_no_iterations_has_zero_tokens() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.errored_session_api).unwrap();

    // API error, no Usage events emitted
    assert_eq!(m.input_tokens, 0);
    assert_eq!(m.output_tokens, 0);
    assert_eq!(m.cache_creation, 0);
    assert_eq!(m.cache_read, 0);
}

#[test]
fn cancelled_session_sums_tokens_from_partial_iterations() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.cancelled_session).unwrap();

    // 1 iteration: input=400, output=200, cache_create=4000, cache_read=0
    assert_eq!(m.input_tokens, 400);
    assert_eq!(m.output_tokens, 200);
    assert_eq!(m.cache_creation, 4000);
    assert_eq!(m.cache_read, 0);
}

// ─── Cost calculation ─────────────────────────────────────────────────

#[test]
fn completed_sonnet_session_cost_matches_pricing_formula() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.completed_session).unwrap();

    // Manual calculation with sonnet pricing:
    // input:        800 * 3.00  / 1M = 0.002400
    // output:       250 * 15.00 / 1M = 0.003750
    // cache_create: 3000 * 3.75 / 1M = 0.011250
    // cache_read:   300 * 0.30  / 1M = 0.000090
    // total:                          = 0.017490
    let expected = pricing::calculate_cost("sonnet", 800, 250, 3000, 300);
    assert_eq!(m.cost, expected);
    assert_eq!(m.cost, dec!(0.017490));
}

#[test]
fn opus_session_is_more_expensive_than_haiku_with_same_tokens() {
    let ds = fixtures::create_test_dataset();
    let opus = aggregate_session_events(&ds.opus_session).unwrap();
    let haiku = aggregate_session_events(&ds.haiku_session).unwrap();

    // Both have identical token counts: input=500, output=300, cache=0, cache_read=0
    assert_eq!(opus.input_tokens, haiku.input_tokens);
    assert_eq!(opus.output_tokens, haiku.output_tokens);

    // Opus must be much more expensive
    assert!(opus.cost > haiku.cost, "opus {} should be > haiku {}", opus.cost, haiku.cost);

    // Verify exact costs
    // haiku: 500*0.25/1M + 300*1.25/1M = 0.000125 + 0.000375 = 0.000500
    // opus:  500*15.0/1M + 300*75.0/1M = 0.007500 + 0.022500 = 0.030000
    assert_eq!(haiku.cost, dec!(0.000500));
    assert_eq!(opus.cost, dec!(0.030000));
}

#[test]
fn errored_session_with_no_tokens_has_zero_cost() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.errored_session_api).unwrap();
    assert_eq!(m.cost, Decimal::ZERO);
}

// ─── Tool counting ───────────────────────────────────────────────────

#[test]
fn completed_session_counts_tool_calls() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.completed_session).unwrap();

    // 2 ToolUse events: read_file + edit_file
    assert_eq!(m.tool_calls, 2);
    // Both succeed
    assert_eq!(m.tool_errors, 0);
}

#[test]
fn session_with_tool_errors_counts_failures_separately() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.session_with_tool_errors).unwrap();

    // 3 ToolUse events: bash, read_file, grep_search
    assert_eq!(m.tool_calls, 3);
    // 2 ToolResult with isError=true: bash + read_file
    assert_eq!(m.tool_errors, 2);
}

#[test]
fn errored_session_counts_its_tool_calls() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.errored_session_tool).unwrap();

    // 1 ToolUse (bash), 1 ToolResult with isError=true
    assert_eq!(m.tool_calls, 1);
    assert_eq!(m.tool_errors, 1);
}

#[test]
fn session_without_tools_has_zero_counts() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.errored_session_api).unwrap();

    assert_eq!(m.tool_calls, 0);
    assert_eq!(m.tool_errors, 0);
}

#[test]
fn cancelled_session_has_zero_tool_counts() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.cancelled_session).unwrap();

    // No ToolUse events in cancelled session fixture
    assert_eq!(m.tool_calls, 0);
    assert_eq!(m.tool_errors, 0);
}

// ─── Iteration counting ──────────────────────────────────────────────

#[test]
fn completed_session_counts_iterations_from_message_stops() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.completed_session).unwrap();

    // 2 MessageStop events = 2 iterations
    assert_eq!(m.iterations, 2);
}

#[test]
fn errored_session_with_no_iterations_has_zero() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.errored_session_api).unwrap();

    assert_eq!(m.iterations, 0);
}

// ─── Status and error classification ─────────────────────────────────

#[test]
fn completed_session_has_correct_status() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.completed_session).unwrap();

    assert_eq!(m.status, "completed");
    assert!(m.error_category.is_none());
}

#[test]
fn errored_tool_session_has_tool_error_category() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.errored_session_tool).unwrap();

    assert_eq!(m.status, "error");
    assert_eq!(m.error_category.as_deref(), Some("tool"));
}

#[test]
fn errored_api_session_has_api_error_category() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.errored_session_api).unwrap();

    assert_eq!(m.status, "error");
    assert_eq!(m.error_category.as_deref(), Some("api"));
}

#[test]
fn cancelled_session_has_no_error_category() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.cancelled_session).unwrap();

    assert_eq!(m.status, "cancelled");
    assert!(m.error_category.is_none());
}

#[test]
fn session_with_tool_errors_still_completes() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.session_with_tool_errors).unwrap();

    // Tool errors don't make the session fail -- it completed
    assert_eq!(m.status, "completed");
    assert!(m.error_category.is_none());
    assert_eq!(m.tool_errors, 2); // but tool errors are still counted
}

// ─── Attribution ─────────────────────────────────────────────────────

#[test]
fn completed_session_extracts_user_and_team() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.completed_session).unwrap();

    assert_eq!(m.user_id, "user-1");
    assert_eq!(m.team_id, "backend");
    assert_eq!(m.model, "sonnet");
}

#[test]
fn opus_session_extracts_correct_model() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.opus_session).unwrap();

    assert_eq!(m.model, "opus");
    assert_eq!(m.team_id, "ml");
    assert_eq!(m.user_id, "user-4");
}

#[test]
fn date_comes_from_session_start_timestamp() {
    let ds = fixtures::create_test_dataset();
    let m = aggregate_session_events(&ds.completed_session).unwrap();

    assert_eq!(m.date.to_string(), "2026-04-04");
}

// ─── Edge cases ──────────────────────────────────────────────────────

#[test]
fn missing_session_start_returns_error() {
    // Events without SessionStart
    let events = vec![fixtures::create_test_dataset().completed_session[1].clone()];
    let result = aggregate_session_events(&events);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("SessionStart"));
}

#[test]
fn missing_session_end_returns_error() {
    let ds = fixtures::create_test_dataset();
    // Only SessionStart, no SessionEnd
    let events = vec![ds.completed_session[0].clone()];
    let result = aggregate_session_events(&events);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("SessionEnd"));
}
