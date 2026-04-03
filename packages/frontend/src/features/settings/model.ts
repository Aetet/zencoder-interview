import { atom, action } from '@reatom/core'
import { api } from '../../shared/api/client'
import type { BudgetData } from '@zendash/shared'

export const budgetState = atom<BudgetData | null>(null, 'settings.budget')
export const budgetInput = atom('6000', 'settings.budgetInput')
export const thresholds = atom<Record<number, boolean>>({ 50: true, 75: true, 90: true, 100: true }, 'settings.thresholds')
export const saving = atom(false, 'settings.saving')
export const settingsLoading = atom(true, 'settings.loading')

export const fetchSettings = action(async () => {
  settingsLoading.set(true)
  try {
    const data = await api.costs.budget()
    budgetState.set(data)
    budgetInput.set(String(data.monthlyBudget))
    const th: Record<number, boolean> = {}
    for (const t of data.thresholds) th[t] = true
    thresholds.set(th)
  } finally {
    settingsLoading.set(false)
  }
}, 'settings.fetch')

export const saveBudget = action(async () => {
  saving.set(true)
  try {
    const amount = Number(budgetInput())
    const activeThresholds = Object.entries(thresholds())
      .filter(([, v]) => v)
      .map(([k]) => Number(k))

    await api.alerts.save({
      monthlyBudget: amount,
      thresholds: activeThresholds,
    })
    await fetchSettings()
  } finally {
    saving.set(false)
  }
}, 'settings.save')
