import { atom, action, computed, wrap } from '@reatom/core'
import { api } from '../../shared/api/client'
import { showToast } from '../../shared/components/Toast'
import { validateOrgBudget, distributeBudget } from '../../shared/utils/budget'
import { knownTeamIds } from './known-team-ids'
import type { BudgetData } from '@zendash/shared'

export function createBudget(name: string) {
  const budgetData = atom<BudgetData>({
    monthlyBudget: 6000, currentSpend: 0, projected: 0,
    percentUsed: 0, thresholds: [50, 75, 90, 100], teamBudgets: [],
  }, `${name}.budgetData`)

  const budgetInput = atom('6000', `${name}.budgetInput`)
  const teamBudgetOverrides = atom<Record<string, number>>({}, `${name}.teamBudgetOverrides`)
  const saving = atom(false, `${name}.saving`)

  const initFromServer = action((config: { monthlyBudget: number; teamOverrides: Record<string, number> }, data: BudgetData) => {
    budgetData.set(data)
    budgetInput.set(String(config.monthlyBudget))
    teamBudgetOverrides.set(config.teamOverrides ?? {})
  }, `${name}.initFromServer`)

  const computedTeamBudgets = computed(() => {
    const b = budgetData()
    let teamIds = b.teamBudgets.map(t => t.teamId)
    if (teamIds.length === 0) teamIds = knownTeamIds()
    const totalBudget = Number(budgetInput()) || b.monthlyBudget
    return distributeBudget(totalBudget, teamIds, teamBudgetOverrides())
  }, `${name}.computedTeamBudgets`)

  const orgBudgetValidation = computed(() => {
    const newBudget = Number(budgetInput())
    const currentSpend = budgetData().currentSpend
    return validateOrgBudget(newBudget, currentSpend, teamBudgetOverrides())
  }, `${name}.orgBudgetValidation`)

  async function persistBudget(overrides: Record<string, number>) {
    await wrap(api.budgets.save({
      monthlyBudget: Number(budgetInput()),
      teamOverrides: overrides,
    }))
  }

  const setTeamOverride = action(async (teamId: string, value: number) => {
    const currentTeamBudget = computedTeamBudgets()[teamId] ?? 0
    const delta = value - currentTeamBudget
    if (delta > 0) {
      const newOrgBudget = Number(budgetInput()) + delta
      budgetInput.set(String(Math.round(newOrgBudget)))
    }

    const updated = { ...teamBudgetOverrides(), [teamId]: value }
    teamBudgetOverrides.set(updated)
    try {
      await persistBudget(updated)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save', 'error')
    }
  }, `${name}.setTeamOverride`)

  const removeTeamOverride = action(async (teamId: string) => {
    const updated = { ...teamBudgetOverrides() }
    delete updated[teamId]
    teamBudgetOverrides.set(updated)
    try {
      await persistBudget(updated)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save', 'error')
    }
  }, `${name}.removeTeamOverride`)

  const saveBudget = action(async () => {
    const validation = orgBudgetValidation()

    if (!validation.valid) {
      showToast(validation.error!, 'error')
      return
    }

    saving.set(true)
    try {
      if (validation.shrunkOverrides) {
        teamBudgetOverrides.set(validation.shrunkOverrides)
        showToast('Department budgets were adjusted to fit the new total', 'info')
      }

      await persistBudget(teamBudgetOverrides())
      showToast('Budget saved successfully')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save budget', 'error')
    } finally {
      saving.set(false)
    }
  }, `${name}.save`)

  return {
    budgetData, budgetInput, teamBudgetOverrides, saving,
    computedTeamBudgets, orgBudgetValidation,
    setTeamOverride, removeTeamOverride, saveBudget, initFromServer,
  }
}
