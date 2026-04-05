/**
 * Budget distribution logic.
 * See docs/mvp/budget-distribution.md for requirements.
 */

export function distributeBudget(
  totalBudget: number,
  teamIds: string[],
  overrides: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {}
  const overrideSum = Object.values(overrides).reduce((s, v) => s + v, 0)
  const autoTeams = teamIds.filter((id) => !(id in overrides))
  const remaining = totalBudget - overrideSum
  const autoBudget = autoTeams.length > 0 && remaining > 0 ? remaining / autoTeams.length : 0

  for (const id of teamIds) {
    result[id] = id in overrides ? overrides[id] : Math.round(autoBudget * 100) / 100
  }
  return result
}

export function shrinkOverrides(
  overrides: Record<string, number>,
  newBudget: number,
): Record<string, number> {
  const sum = Object.values(overrides).reduce((s, v) => s + v, 0)
  if (sum <= newBudget) return { ...overrides }
  const ratio = newBudget / sum
  const result: Record<string, number> = {}
  for (const [id, val] of Object.entries(overrides)) {
    result[id] = Math.max(1, Math.round(val * ratio * 100) / 100)
  }
  return result
}

export interface BudgetValidation {
  valid: boolean
  error?: string
  warning?: string
  shrunkOverrides?: Record<string, number>
}

export function validateOrgBudget(
  newBudget: number,
  currentSpend: number,
  overrides: Record<string, number>,
): BudgetValidation {
  if (newBudget <= 0) {
    return { valid: false, error: 'Budget must be greater than $0' }
  }
  if (newBudget < currentSpend) {
    return { valid: false, error: `Cannot set budget below current spend ($${Math.round(currentSpend)})` }
  }

  const overrideSum = Object.values(overrides).reduce((s, v) => s + v, 0)
  if (overrideSum > 0 && newBudget < overrideSum) {
    const sorted = Object.entries(overrides).sort((a, b) => b[1] - a[1])
    const top3 = sorted.slice(0, 3).map(([id, val]) => `${id} ($${Math.round(val)})`)
    const more = sorted.length > 3 ? ` and ${sorted.length - 3} more` : ''
    return {
      valid: false,
      error: `Budget $${Math.round(newBudget)} is below team overrides total $${Math.round(overrideSum)}: ${top3.join(', ')}${more}. Remove or reduce team overrides first.`,
    }
  }

  return { valid: true }
}

export function getTeamBudgetDelta(
  currentBudget: number,
  newBudget: number,
): { type: 'increase' | 'decrease' | 'same' | 'remove'; delta: number; message: string } {
  if (newBudget <= 0 || isNaN(newBudget)) {
    return { type: 'remove', delta: 0, message: 'This department will use auto-calculated budget.' }
  }
  const delta = newBudget - currentBudget
  if (delta > 0) {
    return {
      type: 'increase',
      delta,
      message: `Your budget will be increased by $${Math.round(delta)}. Other non-overridden departments will receive less.`,
    }
  }
  if (delta < 0) {
    return {
      type: 'decrease',
      delta: Math.abs(delta),
      message: `Budget decreased by $${Math.round(Math.abs(delta))}. Freed budget will be redistributed to non-overridden departments.`,
    }
  }
  return { type: 'same', delta: 0, message: '' }
}
