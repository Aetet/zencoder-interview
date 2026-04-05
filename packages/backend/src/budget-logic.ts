/**
 * Pure budget computation logic. No DB, no side effects.
 */

export class BudgetValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetValidationError'
  }
}

export interface BudgetConfig {
  monthlyBudget: number
  teamOverrides: Record<string, number>
}

/**
 * Compute the effective org budget after applying new overrides.
 *
 * When a team override increases beyond its current allocation,
 * the org budget expands by the delta to keep other teams' budgets unchanged.
 *
 * When a team override is removed, the org budget stays the same
 * (the freed amount gets auto-distributed to other teams).
 *
 * Throws BudgetValidationError if the final budget is below override sum.
 */
export function computeUpdatedBudget(
  current: BudgetConfig,
  incoming: BudgetConfig,
  teamCount: number,
): BudgetConfig {
  const currentOverrides = current.teamOverrides
  const newOverrides = incoming.teamOverrides
  const newOverrideSum = Object.values(newOverrides).reduce((s, v) => s + v, 0)

  // If the caller explicitly changed monthlyBudget, use it directly
  const budgetChanged = Math.abs(incoming.monthlyBudget - current.monthlyBudget) > 0.01
  if (budgetChanged) {
    // Validate: explicit budget must cover overrides
    if (newOverrideSum > 0 && incoming.monthlyBudget < newOverrideSum) {
      throw new BudgetValidationError(
        `Budget $${incoming.monthlyBudget} is below team overrides total $${Math.round(newOverrideSum)}`,
      )
    }
    return { monthlyBudget: incoming.monthlyBudget, teamOverrides: newOverrides }
  }

  // Same budget — compute expansion from override changes
  let monthlyBudget = current.monthlyBudget

  const currentOverrideSum = Object.values(currentOverrides).reduce((s, v) => s + v, 0)
  const currentNonOverridden = teamCount - Object.keys(currentOverrides).length
  const remaining = monthlyBudget - currentOverrideSum
  const autoBudget = currentNonOverridden > 0 && remaining > 0
    ? remaining / currentNonOverridden
    : 0

  for (const [teamId, newValue] of Object.entries(newOverrides)) {
    const oldValue = teamId in currentOverrides
      ? currentOverrides[teamId]
      : autoBudget
    const delta = newValue - oldValue
    if (delta > 0) {
      monthlyBudget += delta
    }
  }

  monthlyBudget = Math.round(monthlyBudget * 100) / 100

  // After expansion, budget should always cover overrides — but validate as safety net
  if (newOverrideSum > 0 && monthlyBudget < newOverrideSum) {
    throw new BudgetValidationError(
      `Budget $${monthlyBudget} is below team overrides total $${Math.round(newOverrideSum)}`,
    )
  }

  return { monthlyBudget, teamOverrides: newOverrides }
}
