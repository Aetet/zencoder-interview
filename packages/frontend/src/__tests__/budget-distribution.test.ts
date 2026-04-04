import { describe, it, expect } from 'vitest'
import { distributeBudget, shrinkOverrides, validateOrgBudget, getTeamBudgetDelta } from '../shared/utils/budget'

// --- BD-1: Auto-distribution ---

describe('BD-1: Auto-distribution', () => {
  const teams = ['a', 'b', 'c', 'd', 'e', 'f']

  it('1.1 - 6 teams, $600, no overrides → $100 each', () => {
    const result = distributeBudget(600, teams, {})
    for (const id of teams) expect(result[id]).toBe(100)
  })

  it('1.2 - 1 override of $300 → remaining 5 get $60', () => {
    const result = distributeBudget(600, teams, { a: 300 })
    expect(result.a).toBe(300)
    for (const id of teams.slice(1)) expect(result[id]).toBe(60)
  })

  it('1.3 - 3 overrides totaling $450 → remaining 3 get $50', () => {
    const result = distributeBudget(600, teams, { a: 200, b: 150, c: 100 })
    expect(result.a).toBe(200)
    expect(result.b).toBe(150)
    expect(result.c).toBe(100)
    for (const id of ['d', 'e', 'f']) expect(result[id]).toBe(50)
  })

  it('1.4 - all teams overridden', () => {
    const overrides = { a: 100, b: 100, c: 100, d: 100, e: 100, f: 100 }
    const result = distributeBudget(600, teams, overrides)
    for (const id of teams) expect(result[id]).toBe(100)
  })

  it('1.5 - auto budget < $1 clamped to $1', () => {
    const result = distributeBudget(10, teams, { a: 9 })
    expect(result.a).toBe(9)
    // remaining $1 / 5 teams = $0.20, clamped to $1
    for (const id of teams.slice(1)) expect(result[id]).toBe(1)
  })

  it('1.6 - single team gets full budget', () => {
    const result = distributeBudget(500, ['solo'], {})
    expect(result.solo).toBe(500)
  })
})

// --- BD-2: Team budget increase ---

describe('BD-2: Team budget increase', () => {
  it('2.1 - increase shows correct delta via getTeamBudgetDelta', () => {
    const result = getTeamBudgetDelta(100, 200)
    expect(result.type).toBe('increase')
    expect(result.delta).toBe(100)
    expect(result.message).toContain('increased by $100')
    expect(result.message).toContain('non-overridden departments')
  })

  it('2.2 - increased override recalculates auto teams lower', () => {
    const teams = ['a', 'b', 'c']
    const before = distributeBudget(300, teams, {})
    expect(before.a).toBe(100) // each $100

    const after = distributeBudget(300, teams, { a: 200 })
    expect(after.a).toBe(200)
    expect(after.b).toBe(50)
    expect(after.c).toBe(50)
  })
})

// --- BD-3: Team budget decrease ---

describe('BD-3: Team budget decrease', () => {
  it('3.1 - decrease shows correct delta via getTeamBudgetDelta', () => {
    const result = getTeamBudgetDelta(200, 100)
    expect(result.type).toBe('decrease')
    expect(result.delta).toBe(100)
    expect(result.message).toContain('decreased by $100')
    expect(result.message).toContain('redistributed')
  })

  it('3.2 - decreased override recalculates auto teams higher', () => {
    const teams = ['a', 'b', 'c']
    const after = distributeBudget(300, teams, { a: 50 })
    expect(after.a).toBe(50)
    expect(after.b).toBe(125)
    expect(after.c).toBe(125)
  })
})

// --- BD-4: Remove override ---

describe('BD-4: Remove override', () => {
  it('4.1 - removing override returns team to auto', () => {
    const teams = ['a', 'b', 'c']
    const withOverride = distributeBudget(300, teams, { a: 200 })
    expect(withOverride.a).toBe(200)

    const without = distributeBudget(300, teams, {})
    expect(without.a).toBe(100)
  })

  it('4.2 - getTeamBudgetDelta shows remove message for zero/NaN', () => {
    const zero = getTeamBudgetDelta(100, 0)
    expect(zero.type).toBe('remove')
    expect(zero.message).toContain('auto-calculated')

    const nan = getTeamBudgetDelta(100, NaN)
    expect(nan.type).toBe('remove')
  })

  it('4.3 - getTeamBudgetDelta shows same for no change', () => {
    const result = getTeamBudgetDelta(100, 100)
    expect(result.type).toBe('same')
    expect(result.delta).toBe(0)
  })
})

// --- BD-5: Org budget lower than spend ---

describe('BD-5: Org budget lower than spend', () => {
  it('5.1 - budget below spend → error, blocked', () => {
    const result = validateOrgBudget(400, 500, {})
    expect(result.valid).toBe(false)
    expect(result.error).toContain('current spend')
  })

  it('5.2 - budget equal to spend → valid', () => {
    const result = validateOrgBudget(500, 500, {})
    expect(result.valid).toBe(true)
  })
})

// --- BD-6: Org budget lower than overrides ---

describe('BD-6: Org budget lower than sum of overrides', () => {
  it('6.1 - warning when budget < override sum', () => {
    const result = validateOrgBudget(400, 100, { a: 300, b: 200 })
    expect(result.valid).toBe(true)
    expect(result.warning).toContain('shrunk')
  })

  it('6.2 - warning lists teams', () => {
    const result = validateOrgBudget(400, 100, { a: 300, b: 200 })
    expect(result.warning).toContain('a')
    expect(result.warning).toContain('b')
  })

  it('6.3 - more than 6 overrides shows "and N more"', () => {
    const overrides: Record<string, number> = {}
    for (let i = 0; i < 10; i++) overrides[`team${i}`] = 100
    const result = validateOrgBudget(500, 100, overrides)
    expect(result.warning).toContain('and 4 more')
  })

  it('6.4 - overrides shrunk proportionally', () => {
    const shrunk = shrinkOverrides({ a: 300, b: 200 }, 400)
    // ratio = 400/500 = 0.8
    expect(shrunk.a).toBe(240)
    expect(shrunk.b).toBe(160)
  })

  it('6.5 - shrunk override below $1 clamped', () => {
    const shrunk = shrinkOverrides({ a: 1, b: 1000 }, 10)
    expect(shrunk.a).toBeGreaterThanOrEqual(1)
  })

  it('6.6 - shrunk overrides returned for saving', () => {
    const result = validateOrgBudget(400, 100, { a: 300, b: 200 })
    expect(result.shrunkOverrides).toBeDefined()
    expect(result.shrunkOverrides!.a).toBe(240)
    expect(result.shrunkOverrides!.b).toBe(160)
  })
})

// --- BD-7: Zero or negative ---

describe('BD-7: Zero or negative budget', () => {
  it('7.1 - budget 0 → error', () => {
    const result = validateOrgBudget(0, 0, {})
    expect(result.valid).toBe(false)
    expect(result.error).toContain('greater than $0')
  })

  it('7.2 - negative budget → error', () => {
    const result = validateOrgBudget(-100, 0, {})
    expect(result.valid).toBe(false)
    expect(result.error).toContain('greater than $0')
  })
})

// --- BD-8: Edge cases ---

describe('BD-8: Edge cases', () => {
  it('8.1 - all overridden, budget shrink → all shrunk', () => {
    const shrunk = shrinkOverrides({ a: 200, b: 200, c: 200 }, 300)
    // ratio = 300/600 = 0.5
    expect(shrunk.a).toBe(100)
    expect(shrunk.b).toBe(100)
    expect(shrunk.c).toBe(100)
  })

  it('8.2 - budget increase after shrink → overrides stay', () => {
    const shrunk = shrinkOverrides({ a: 100, b: 100 }, 100)
    // After shrink, overrides are 50 each
    // Increasing budget doesn't change overrides
    const distributed = distributeBudget(500, ['a', 'b', 'c'], shrunk)
    expect(distributed.a).toBe(shrunk.a)
    expect(distributed.b).toBe(shrunk.b)
    // Auto team gets the rest
    expect(distributed.c).toBe(500 - shrunk.a - shrunk.b)
  })

  it('8.3 - override equals auto budget → stored but same value', () => {
    const teams = ['a', 'b', 'c']
    const auto = distributeBudget(300, teams, {})
    expect(auto.a).toBe(100)
    const withOverride = distributeBudget(300, teams, { a: 100 })
    expect(withOverride.a).toBe(100) // same value
    expect(withOverride.b).toBe(100) // unchanged
  })
})
