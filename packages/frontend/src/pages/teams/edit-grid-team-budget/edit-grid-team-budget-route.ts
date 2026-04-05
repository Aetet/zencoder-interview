import { atom, action, computed, wrap } from "@reatom/core"
import { teamsRoute, budgetView } from "../teams-route"
import { api } from "../../../shared/api/client"
import { getTeamBudgetDelta } from "../../../shared/utils/budget"
import { showToast } from "../../../shared/components/Toast"

// /teams?editTeam=:id — edit team budget from the all-teams grid
export const editGridTeamBudgetRoute = teamsRoute
  .reatomRoute({
    params({ editTeam }: { editTeam?: string }) {
      return editTeam ? { editTeam } : null
    },
  })
  .extend(edit => {
    const editingValue = atom("", "editGridTeamBudget.value")
    const isOpen = computed(() => edit() !== null, "editGridTeamBudget.isOpen")

    const editingTeamId = computed(() => {
      return edit()?.editTeam ?? null
    }, "editGridTeamBudget.teamId")

    const editingDelta = computed(() => {
      const teamId = editingTeamId()
      if (!teamId) return null
      const bv = budgetView()
      const entry = bv.teamBudgets.find(t => t.teamId === teamId)
      const currentBudget = entry?.budget ?? bv.autoBudget
      const newValue = Number(editingValue())
      return getTeamBudgetDelta(currentBudget, newValue)
    }, "editGridTeamBudget.delta")

    const open = action((teamId: string) => {
      const bv = budgetView()
      const entry = bv.teamBudgets.find(t => t.teamId === teamId)
      const current = entry?.budget ?? bv.autoBudget
      editingValue.set(String(Math.round(current)))
      edit.go({ editTeam: teamId })
    }, "editGridTeamBudget.open")

    const close = action(() => {
      edit.go({})
    }, "editGridTeamBudget.close")

    const save = action(async () => {
      const teamId = editingTeamId()
      if (!teamId) return

      const newValue = Number(editingValue())
      const budget = isNaN(newValue) || newValue <= 0 ? null : Math.max(1, newValue)

      await wrap(api.budgets.saveTeam(teamId, budget))
      showToast(budget === null
        ? `Override removed for ${teamId} — using auto budget`
        : `Budget for ${teamId} saved: $${Math.round(budget)}`)

      edit.go({})
    }, "editGridTeamBudget.save")

    return { editingValue, editingTeamId, isOpen, editingDelta, open, close, save }
  })
