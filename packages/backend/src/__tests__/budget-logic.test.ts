import { describe, it, expect } from 'vitest'
import { computeUpdatedBudget, BudgetValidationError } from '../budget-logic.js'

describe('computeUpdatedBudget', () => {
  const TEAM_COUNT = 1000

  describe('org budget expansion', () => {
    it('expands when team override exceeds auto-distributed allocation', () => {
      // $6000 / 1000 teams = $6 per team
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 6000, teamOverrides: { backend: 20 } },
        TEAM_COUNT,
      )
      // delta = 20 - 6 = 14
      expect(result.monthlyBudget).toBe(6014)
      expect(result.teamOverrides).toEqual({ backend: 20 })
    })

    it('expands when existing override is increased', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: { backend: 13 } },
        { monthlyBudget: 6000, teamOverrides: { backend: 20 } },
        TEAM_COUNT,
      )
      // delta = 20 - 13 = 7
      expect(result.monthlyBudget).toBe(6007)
    })

    it('does not shrink when override is decreased', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: { backend: 500 } },
        { monthlyBudget: 6000, teamOverrides: { backend: 200 } },
        TEAM_COUNT,
      )
      // delta = 200 - 500 = -300, negative → no expansion
      expect(result.monthlyBudget).toBe(6000)
    })

    it('does not change when override equals current allocation', () => {
      // auto = 6000 / 1000 = 6
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 6000, teamOverrides: { backend: 6 } },
        TEAM_COUNT,
      )
      expect(result.monthlyBudget).toBe(6000)
    })
  })

  describe('override removal', () => {
    it('keeps org budget when override is removed', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6500, teamOverrides: { backend: 500 } },
        { monthlyBudget: 6500, teamOverrides: {} },
        TEAM_COUNT,
      )
      // Removing override doesn't shrink org budget
      expect(result.monthlyBudget).toBe(6500)
      expect(result.teamOverrides).toEqual({})
    })
  })

  describe('explicit monthly budget change', () => {
    it('respects explicit budget change without expansion', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 8000, teamOverrides: {} },
        TEAM_COUNT,
      )
      expect(result.monthlyBudget).toBe(8000)
    })

    it('respects explicit budget decrease', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 3000, teamOverrides: {} },
        TEAM_COUNT,
      )
      expect(result.monthlyBudget).toBe(3000)
    })
  })

  describe('multiple overrides', () => {
    it('expands for each increased override', () => {
      // auto = 6000 / 1000 = 6
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 6000, teamOverrides: { backend: 100, frontend: 50 } },
        TEAM_COUNT,
      )
      // backend: 100 - 6 = 94, frontend: 50 - 6 = 44
      expect(result.monthlyBudget).toBe(6138)
    })

    it('only expands for increased overrides, not decreased', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: { backend: 100, frontend: 50 } },
        { monthlyBudget: 6000, teamOverrides: { backend: 120, frontend: 30 } },
        TEAM_COUNT,
      )
      // backend: 120 - 100 = 20 (expand), frontend: 30 - 50 = -20 (no shrink)
      expect(result.monthlyBudget).toBe(6020)
    })
  })

  describe('validation: budget below override sum', () => {
    it('rejects when explicit budget is below override sum', () => {
      expect(() => computeUpdatedBudget(
        { monthlyBudget: 100000, teamOverrides: { alpha: 9000 } },
        { monthlyBudget: 900, teamOverrides: { alpha: 9000 } },
        1000,
      )).toThrow(BudgetValidationError)
    })

    it('expands when overrides exceed current budget (auto-expansion)', () => {
      // Budget unchanged (6000), overrides sum 7000 — expansion covers the difference
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 6000, teamOverrides: { a: 4000, b: 3000 } },
        1000,
      )
      // auto = 6, a: 4000-6=3994, b: 3000-6=2994 → 6000+6988=12988
      expect(result.monthlyBudget).toBe(12988)
    })

    it('allows when budget equals override sum exactly', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 100, teamOverrides: { a: 50, b: 50 } },
        1000,
      )
      expect(result.monthlyBudget).toBe(100)
    })

    it('allows when no overrides', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 1, teamOverrides: {} },
        1000,
      )
      expect(result.monthlyBudget).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('handles zero teams', () => {
      const result = computeUpdatedBudget(
        { monthlyBudget: 6000, teamOverrides: {} },
        { monthlyBudget: 6000, teamOverrides: { backend: 100 } },
        0,
      )
      // auto = 0 (no teams), delta = 100 - 0 = 100
      expect(result.monthlyBudget).toBe(6100)
    })

    it('handles all teams overridden — expands budget', () => {
      // Budget is same (100), so expansion logic runs: a goes 50→70, delta=20
      // But new override sum (70+50=120) > budget (100) → validation rejects
      // So the budget must already be >= override sum for this to work
      const result = computeUpdatedBudget(
        { monthlyBudget: 200, teamOverrides: { a: 50, b: 50 } },
        { monthlyBudget: 200, teamOverrides: { a: 70, b: 50 } },
        2,
      )
      // a: 70 - 50 = 20 expansion
      expect(result.monthlyBudget).toBe(220)
    })
  })
})
