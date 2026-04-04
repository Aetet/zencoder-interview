import { atom, action, computed, reatomRoute, wrap } from '@reatom/core'
import { api } from '../../shared/api/client'
import type { BudgetData } from '@zendash/shared'

export const settingsRoute = reatomRoute({
  path: 'settings',
  async loader() {
    return await wrap(api.costs.budget())
  },
}).extend((route) => {
  const INITIAL: BudgetData = {
    monthlyBudget: 6000, currentSpend: 0, projected: 0,
    percentUsed: 0, thresholds: [50, 75, 90, 100], teamBudgets: [],
  }

  function data() {
    return route.loader.data() ?? INITIAL
  }

  const budget = computed(() => data(), 'settings.budget')
  const budgetInput = atom('6000', 'settings.budgetInput')
  const thresholds = atom<Record<number, boolean>>(
    { 50: true, 75: true, 90: true, 100: true },
    'settings.thresholds',
  )
  const saving = atom(false, 'settings.saving')

  // Sync input from loader
  const syncFromLoader = action(() => {
    const d = data()
    budgetInput.set(String(d.monthlyBudget))
    const th: Record<number, boolean> = {}
    for (const t of d.thresholds) th[t] = true
    thresholds.set(th)
  }, 'settings.syncFromLoader')

  const saveBudget = action(async () => {
    saving.set(true)
    try {
      const amount = Number(budgetInput())
      const activeThresholds = Object.entries(thresholds())
        .filter(([, v]) => v)
        .map(([k]) => Number(k))
      await wrap(api.alerts.save({ monthlyBudget: amount, thresholds: activeThresholds }))
      route.loader.retry()
    } finally {
      saving.set(false)
    }
  }, 'settings.save')

  return { budget, budgetInput, thresholds, saving, syncFromLoader, saveBudget }
})
