//! Tests for pricing calculation.
//!
//! Verifies that our Rust pricing matches the TypeScript pricing exactly.
//! These values are the contract between Rust and TypeScript -- if they
//! drift, the dashboard will show wrong costs.

use rust_decimal_macros::dec;
use zendash_simulator::models::pricing::{self, calculate_cost};

#[test]
fn haiku_pricing_matches_typescript() {
    let p = pricing::get_pricing("haiku");
    assert_eq!(p.input, dec!(0.25));
    assert_eq!(p.output, dec!(1.25));
    assert_eq!(p.cache_create, dec!(0.30));
    assert_eq!(p.cache_read, dec!(0.03));
}

#[test]
fn sonnet_pricing_matches_typescript() {
    let p = pricing::get_pricing("sonnet");
    assert_eq!(p.input, dec!(3.00));
    assert_eq!(p.output, dec!(15.00));
    assert_eq!(p.cache_create, dec!(3.75));
    assert_eq!(p.cache_read, dec!(0.30));
}

#[test]
fn opus_pricing_matches_typescript() {
    let p = pricing::get_pricing("opus");
    assert_eq!(p.input, dec!(15.00));
    assert_eq!(p.output, dec!(75.00));
    assert_eq!(p.cache_create, dec!(18.75));
    assert_eq!(p.cache_read, dec!(1.50));
}

#[test]
fn unknown_model_defaults_to_sonnet() {
    let p = pricing::get_pricing("gpt-4");
    assert_eq!(p.input, dec!(3.00));
}

#[test]
fn cost_formula_haiku() {
    // 1000 input * 0.25 / 1M = 0.000250
    // 500 output * 1.25 / 1M = 0.000625
    // 200 cache_create * 0.30 / 1M = 0.000060
    // 100 cache_read * 0.03 / 1M = 0.000003
    // total = 0.000938
    let cost = calculate_cost("haiku", 1000, 500, 200, 100);
    assert_eq!(cost, dec!(0.000938));
}

#[test]
fn cost_formula_sonnet() {
    // 1000 * 3.00 / 1M = 0.003000
    // 500 * 15.00 / 1M = 0.007500
    // 200 * 3.75 / 1M = 0.000750
    // 100 * 0.30 / 1M = 0.000030
    // total = 0.011280
    let cost = calculate_cost("sonnet", 1000, 500, 200, 100);
    assert_eq!(cost, dec!(0.011280));
}

#[test]
fn cost_formula_opus() {
    // 1000 * 15.00 / 1M = 0.015000
    // 500 * 75.00 / 1M = 0.037500
    // 200 * 18.75 / 1M = 0.003750
    // 100 * 1.50 / 1M = 0.000150
    // total = 0.056400
    let cost = calculate_cost("opus", 1000, 500, 200, 100);
    assert_eq!(cost, dec!(0.056400));
}

#[test]
fn zero_tokens_zero_cost() {
    assert_eq!(calculate_cost("sonnet", 0, 0, 0, 0), dec!(0));
}

#[test]
fn opus_is_60x_more_expensive_than_haiku_for_input() {
    // opus input: 15.00, haiku input: 0.25 → ratio = 60
    let haiku = calculate_cost("haiku", 1_000_000, 0, 0, 0);
    let opus = calculate_cost("opus", 1_000_000, 0, 0, 0);
    assert_eq!(opus / haiku, dec!(60));
}
