import { atom, action, computed, wrap } from "@reatom/core"
import { teamRoute } from "../team/team-route"
import { api } from "../../../shared/api/client"
import { getTeamBudgetDelta } from "../../../shared/utils/budget"
import { showToast } from "../../../shared/components/Toast"

export const editTeamBudgetRoute = teamRoute
  .reatomRoute({
    params({ edit, teamId }: { edit?: string; teamId?: string }) {
      return edit === "true" ? { edit, teamId: teamId ?? "" } : null
    },
  })
  .extend(edit => {
    const editingValue = atom("", "editTeamBudget.value")
    const isOpen = computed(() => edit() !== null, "editTeamBudget.isOpen")

    const editingTeamId = computed(() => {
      if (!isOpen()) return null
      return edit()?.teamId ?? teamRoute.selectedTeamId()
    }, "editTeamBudget.teamId")

    const editingDelta = computed(() => {
      const teamId = editingTeamId()
      if (!teamId) return null
      const currentBudget = teamRoute.teamBudgetAllocation() ?? 1
      const newValue = Number(editingValue())
      return getTeamBudgetDelta(currentBudget, newValue)
    }, "editTeamBudget.delta")

    const open = action((teamId?: string) => {
      const id = teamId ?? teamRoute.selectedTeamId()
      if (!id) return
      const current = teamRoute.teamBudgetAllocation() ?? 1
      editingValue.set(String(Math.round(current)))
      edit.go({ teamId: id, edit: "true" })
    }, "editTeamBudget.open")

    const close = action(() => {
      edit.inputParams.set(null)
    }, "editTeamBudget.close")

    const save = action(async () => {
      const teamId = editingTeamId()
      if (!teamId) return

      const newValue = Number(editingValue())
      const budget = isNaN(newValue) || newValue <= 0 ? null : Math.max(1, newValue)

      await wrap(api.budgets.saveTeam(teamId, budget))
      showToast(budget === null
        ? `Override removed for ${teamId} — using auto budget`
        : `Budget for ${teamId} saved: $${Math.round(budget)}`)

      teamRoute.loader.retry()
      edit.inputParams.set(null)
    }, "editTeamBudget.save")

    return { editingValue, editingTeamId, isOpen, editingDelta, open, close, save }
  })
