export const MODEL_PRICING = {
  haiku: { input: 0.25, output: 1.25, cacheCreate: 0.30, cacheRead: 0.03 },
  sonnet: { input: 3.00, output: 15.00, cacheCreate: 3.75, cacheRead: 0.30 },
  opus: { input: 15.00, output: 75.00, cacheCreate: 18.75, cacheRead: 1.50 },
} as const

export type ModelTier = keyof typeof MODEL_PRICING

export function calculateCost(
  model: ModelTier,
  tokens: { input: number; output: number; cacheCreation: number; cacheRead: number },
): number {
  const p = MODEL_PRICING[model]
  return (
    (tokens.input * p.input +
      tokens.output * p.output +
      tokens.cacheCreation * p.cacheCreate +
      tokens.cacheRead * p.cacheRead) / 1_000_000
  )
}
