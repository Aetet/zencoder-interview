use rust_decimal::Decimal;
use rust_decimal_macros::dec;

/// Default organization-wide monthly budget in USD.
pub const DEFAULT_MONTHLY_BUDGET: Decimal = dec!(6000);

/// Percentage thresholds that trigger alerts.
/// When org spend crosses these percentages of the monthly budget,
/// alerts are generated with escalating severity:
///   50% → info, 75% → warning, 90% → warning, 100% → error
pub const DEFAULT_THRESHOLDS: &[i32] = &[50, 75, 90, 100];

/// Spend spike detection multiplier.
/// A team's daily spend must exceed this multiple of its 7-day average
/// to trigger a `spend_spike` alert.
pub const SPIKE_MULTIPLIER: Decimal = dec!(2.0);

/// Maximum number of alerts returned by the alerts endpoint.
pub const MAX_ALERTS: usize = 25;

/// Number of teams checked for spend spikes (first N teams by spend).
pub const SPIKE_CHECK_TEAM_LIMIT: usize = 30;

/// Hardcoded retryable recovery rate (placeholder until real tracking).
pub const RETRYABLE_RECOVERY_RATE: f64 = 0.60;

/// Default team budget overrides.
/// Empty by default -- all teams get auto-distributed budget:
/// `(monthly_budget - sum(overrides)) / remaining_team_count`
///
/// Format: `[("team-id", budget_amount)]`
///
/// Example with overrides:
/// ```ignore
/// pub const DEFAULT_TEAM_OVERRIDES: &[(&str, Decimal)] = &[
///     ("backend", dec!(500)),
///     ("ml", dec!(1200)),
/// ];
/// ```
pub const DEFAULT_TEAM_OVERRIDES: &[(&str, Decimal)] = &[];
