use rust_decimal::Decimal;
use rust_decimal_macros::dec;

/// Per-model token pricing (per 1,000,000 tokens).
/// Must match TypeScript pricing exactly.
pub struct ModelPricing {
    pub input: Decimal,
    pub output: Decimal,
    pub cache_create: Decimal,
    pub cache_read: Decimal,
}

pub const HAIKU_PRICING: ModelPricing = ModelPricing {
    input: dec!(0.25),
    output: dec!(1.25),
    cache_create: dec!(0.30),
    cache_read: dec!(0.03),
};

pub const SONNET_PRICING: ModelPricing = ModelPricing {
    input: dec!(3.00),
    output: dec!(15.00),
    cache_create: dec!(3.75),
    cache_read: dec!(0.30),
};

pub const OPUS_PRICING: ModelPricing = ModelPricing {
    input: dec!(15.00),
    output: dec!(75.00),
    cache_create: dec!(18.75),
    cache_read: dec!(1.50),
};

pub fn get_pricing(model: &str) -> &'static ModelPricing {
    match model {
        "haiku" => &HAIKU_PRICING,
        "sonnet" => &SONNET_PRICING,
        "opus" => &OPUS_PRICING,
        _ => &SONNET_PRICING,
    }
}

const PER_MILLION: Decimal = dec!(1000000);

pub fn calculate_cost(
    model: &str,
    input_tokens: i64,
    output_tokens: i64,
    cache_creation: i64,
    cache_read: i64,
) -> Decimal {
    let p = get_pricing(model);
    let input = Decimal::from(input_tokens) * p.input;
    let output = Decimal::from(output_tokens) * p.output;
    let cache_c = Decimal::from(cache_creation) * p.cache_create;
    let cache_r = Decimal::from(cache_read) * p.cache_read;
    (input + output + cache_c + cache_r) / PER_MILLION
}
