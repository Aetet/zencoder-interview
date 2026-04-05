import { atom, computed, reatomRoute, wrap } from '@reatom/core'
import { api } from '../../shared/api/client'
import type { AlertEvent } from '@zendash/shared'

export const alertsRoute = reatomRoute({
  path: 'settings',
  async loader() {
    const [alertHistory, budgetConfig] = await Promise.all([
      wrap(api.alerts.list()),
      wrap(api.budgets.get()),
    ])
    return { alertHistory, monthlyBudget: budgetConfig.monthlyBudget }
  },
}).extend((route) => {
  function data() {
    return route.loader.data() ?? { alertHistory: [] as AlertEvent[], monthlyBudget: 6000 }
  }

  const alertHistory = computed(() => data().alertHistory, 'alerts.alertHistory')
  const monthlyBudget = computed(() => data().monthlyBudget, 'alerts.monthlyBudget')
  const thresholds = atom<Record<number, boolean>>(
    { 50: true, 75: true, 90: true, 100: true },
    'alerts.thresholds',
  )

  return { alertHistory, monthlyBudget, thresholds }
})
