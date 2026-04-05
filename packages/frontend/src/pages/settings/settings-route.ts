import { atom, action, computed, reatomBoolean, reatomRoute, wrap } from '@reatom/core'
import { api } from '../../shared/api/client'
import { showToast } from '../../shared/components/Toast'
import { validateOrgBudget, distributeBudget } from '../../shared/utils/budget'
import type { BudgetData, AlertEvent } from '@zendash/shared'

export const settingsRoute = reatomRoute({
  path: 'settings',
  async loader() {
    const [budgetData, budgetConfig, alertHistory] = await Promise.all([
      wrap(api.costs.budget()),
      wrap(api.budgets.get()),
      wrap(api.alerts.list()),
    ])
    return { budgetData, budgetConfig, alertHistory }
  },
}).extend((route) => {
  const INITIAL = {
    budgetData: {
      monthlyBudget: 6000, currentSpend: 0, projected: 0,
      percentUsed: 0, thresholds: [50, 75, 90, 100], teamBudgets: [],
    } satisfies BudgetData,
    budgetConfig: { monthlyBudget: 6000, teamOverrides: {} as Record<string, number> },
    alertHistory: [] as AlertEvent[],
  }

  function data() {
    return route.loader.data() ?? INITIAL
  }

  const budget = computed(() => data().budgetData, 'settings.budget')
  const alertHistory = computed(() => data().alertHistory, 'settings.alertHistory')

  const budgetInput = atom('6000', 'settings.budgetInput')
  const thresholds = atom<Record<number, boolean>>({}, 'settings.thresholds')
  const teamBudgetOverrides = atom<Record<string, number>>({}, 'settings.teamBudgetOverrides')

  const initFromServer = action(() => {
    const cfg = data().budgetConfig
    const bd = data().budgetData
    budgetInput.set(String(cfg.monthlyBudget))
    const thresholdMap: Record<number, boolean> = {}
    for (const t of bd.thresholds) thresholdMap[t] = true
    thresholds.set(thresholdMap)
    teamBudgetOverrides.set(cfg.teamOverrides ?? {})
  }, 'settings.initFromServer')

  const saving = atom(false, 'settings.saving')

  // External team IDs source — set by teams route when it loads
  const knownTeamIds = atom<string[]>([], 'settings.knownTeamIds')

  const computedTeamBudgets = computed(() => {
    const b = data().budgetData
    let teamIds = b.teamBudgets.map(t => t.teamId)
    if (teamIds.length === 0) teamIds = knownTeamIds()
    const totalBudget = Number(budgetInput()) || b.monthlyBudget
    return distributeBudget(totalBudget, teamIds, teamBudgetOverrides())
  }, 'settings.computedTeamBudgets')

  const orgBudgetValidation = computed(() => {
    const newBudget = Number(budgetInput())
    const currentSpend = data().budgetData.currentSpend
    return validateOrgBudget(newBudget, currentSpend, teamBudgetOverrides())
  }, 'settings.orgBudgetValidation')

  async function persistBudget(overrides: Record<string, number>) {
    await wrap(api.budgets.save({
      monthlyBudget: Number(budgetInput()),
      teamOverrides: overrides,
    }))
  }

  const setTeamOverride = action(async (teamId: string, value: number) => {
    // Increase org budget by the delta between new and current team budget
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
  }, 'settings.setTeamOverride')

  const removeTeamOverride = action(async (teamId: string) => {
    const updated = { ...teamBudgetOverrides() }
    delete updated[teamId]
    teamBudgetOverrides.set(updated)
    try {
      await persistBudget(updated)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save', 'error')
    }
  }, 'settings.removeTeamOverride')

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
  }, 'settings.save')

  const teamBudgetsExpanded = reatomBoolean(false, 'settings.teamBudgetsExpanded')

  return {
    budget, alertHistory, budgetInput, thresholds, saving, saveBudget, teamBudgetsExpanded,
    teamBudgetOverrides, computedTeamBudgets, orgBudgetValidation, knownTeamIds,
    setTeamOverride, removeTeamOverride, initFromServer,
  }
})
