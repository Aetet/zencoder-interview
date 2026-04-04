import { atom, action, computed, reatomBoolean, reatomRoute, wrap } from '@reatom/core'
import { z } from 'zod/v4'
import { api } from '../../shared/api/client'
import { showToast } from '../../shared/components/Toast'
import type { BudgetData, AlertConfig } from '@zendash/shared'

const LS_KEY = 'zendash:budget'
const LS_TEAM_BUDGETS_KEY = 'zendash:team-budgets'

function loadFromStorage(): AlertConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveToStorage(config: AlertConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(config))
}

function loadTeamBudgets(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_TEAM_BUDGETS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveTeamBudgets(budgets: Record<string, number>) {
  localStorage.setItem(LS_TEAM_BUDGETS_KEY, JSON.stringify(budgets))
}

export function getSavedBudgetConfig(): AlertConfig {
  return loadFromStorage() ?? { monthlyBudget: 6000, thresholds: [50, 75, 90, 100] }
}

export function getTeamBudget(teamId: string): number {
  return loadTeamBudgets()[teamId] ?? 1
}

export const settingsRoute = reatomRoute({
  path: 'settings',
  async loader() {
    return await wrap(api.costs.budget())
  },
}).extend((route) => {
  const saved = getSavedBudgetConfig()

  const INITIAL: BudgetData = {
    monthlyBudget: saved.monthlyBudget, currentSpend: 0, projected: 0,
    percentUsed: 0, thresholds: saved.thresholds, teamBudgets: [],
  }

  function data() {
    return route.loader.data() ?? INITIAL
  }

  const budget = computed(() => data(), 'settings.budget')
  const budgetInput = atom(String(saved.monthlyBudget), 'settings.budgetInput')

  const initThresholds: Record<number, boolean> = {}
  for (const t of saved.thresholds) initThresholds[t] = true
  const thresholds = atom<Record<number, boolean>>(initThresholds, 'settings.thresholds')

  const saving = atom(false, 'settings.saving')

  // Per-team budgets — loaded from localStorage, default $1
  const teamBudgets = atom<Record<string, number>>(loadTeamBudgets(), 'settings.teamBudgets')

  // Modal route for editing team budget — search-only, preserves /settings path
  const editTeamModal = reatomRoute({
    search: z.object({
      editTeam: z.string().optional(),
    }),
  })

  const editingTeamValue = atom('', 'settings.editingTeamValue')

  const openEditTeam = action((teamId: string) => {
    editingTeamValue.set(String(teamBudgets()[teamId] ?? 1))
    editTeamModal.go({ editTeam: teamId })
  }, 'settings.openEditTeam')

  const closeEditTeam = action(() => {
    editTeamModal.go({})
  }, 'settings.closeEditTeam')

  const saveTeamBudgetAction = action(() => {
    const params = editTeamModal()
    const teamId = params?.editTeam
    if (!teamId) return
    const value = Math.max(0, Number(editingTeamValue()) || 1)
    const updated = { ...teamBudgets(), [teamId]: value }
    teamBudgets.set(updated)
    saveTeamBudgets(updated)
    editTeamModal.go({})
    showToast(`Budget for ${teamId} saved: $${value}`)
  }, 'settings.saveTeamBudget')

  const saveBudget = action(async () => {
    saving.set(true)
    try {
      const amount = Number(budgetInput())
      const activeThresholds = Object.entries(thresholds())
        .filter(([, v]) => v)
        .map(([k]) => Number(k))

      const config: AlertConfig = { monthlyBudget: amount, thresholds: activeThresholds }
      saveToStorage(config)
      wrap(api.alerts.save(config))
      showToast('Budget saved successfully')
    } finally {
      saving.set(false)
    }
  }, 'settings.save')

  // Collapsible state — persisted in route, not in component useState
  const teamBudgetsExpanded = reatomBoolean(false, 'settings.teamBudgetsExpanded')

  return {
    budget, budgetInput, thresholds, saving, saveBudget, teamBudgetsExpanded,
    teamBudgets, editTeamModal, editingTeamValue,
    openEditTeam, closeEditTeam, saveTeamBudget: saveTeamBudgetAction,
  }
})
