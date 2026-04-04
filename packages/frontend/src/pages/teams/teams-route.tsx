import { atom, action, computed, reatomRoute, wrap } from "@reatom/core"
import { api } from "../../shared/api/client"
import { filterParams } from "../../shared/filters/model"
import { settingsRoute } from "../settings/settings-route"
import { getTeamBudgetDelta, validateOrgBudget } from "../../shared/utils/budget"
import { showToast } from "../../shared/components/Toast"
import { Skeleton } from "../../shared/components/Skeleton"
import { TeamTabs } from "./components/TeamTabs"
import { AllTeamsContent } from "./all-teams-page"
import { TeamPage } from "./team-page"
import { DeferredMount } from "../../shared/components/DeferredMount"
import type { Team, TeamUser } from "@zendash/shared"

// /teams — layout: tabs + outlet + modals
export const teamsRoute = reatomRoute({
  path: "teams",
  async loader() {
    const params = filterParams()
    const [teams, budgetConfig] = await Promise.all([
      wrap(api.teams.list(params)),
      wrap(api.budgets.get()),
    ])
    // Init budget state from server
    settingsRoute.budgetInput.set(String(budgetConfig.monthlyBudget))
    settingsRoute.teamBudgetOverrides.set(budgetConfig.teamOverrides ?? {})
    return teams
  },
  render(self) {
    const isExact = self.exact()
    const loading = !self.loader.ready() && !self.loader.data()

    return (
      <div className="flex flex-col gap-4 h-full">
        <div className="sticky top-0 z-10 bg-background pb-2 -mb-2">
          <TeamTabs />
        </div>
        {loading ? (
          <Skeleton className="flex-1" />
        ) : (
          <>
            <div className={isExact ? "contents" : "hidden"}>
              <DeferredMount>
                <AllTeamsContent />
              </DeferredMount>
            </div>
            {!isExact && self.outlet().map((child, i) => <div key={i} className="flex flex-col gap-4">{child}</div>)}
          </>
        )}
      </div>
    )
  },
}).extend(route => {
  const teamsList = computed(() => {
    const teams = route.loader.data() ?? ([] as Team[])
    // Keep settings route aware of team IDs for budget computation
    if (teams.length > 0) {
      settingsRoute.knownTeamIds.set(teams.map(t => t.id))
    }
    return teams
  }, "teams.list")

  return { teamsList }
})

// /teams?edit — org budget modal (search-only)
export const editBudgetRoute = teamsRoute
  .reatomRoute({
    params({ edit }: { edit?: string }) {
      return edit !== undefined ? { edit } : null
    },
  })
  .extend(edit => {
    const editingValue = atom("", "editBudget.value")

    const isOpen = computed(() => edit() !== null, "editBudget.isOpen")

    const open = action(() => {
      editingValue.set(settingsRoute.budgetInput())
      edit.go({ edit: "" })
    }, "editBudget.open")

    const close = action(() => {
      edit.go({})
    }, "editBudget.close")

    const validation = computed(() => {
      const amount = Number(editingValue())
      if (!amount) return null
      const currentSpend = settingsRoute.budget()?.currentSpend ?? 0
      return validateOrgBudget(amount, currentSpend, settingsRoute.teamBudgetOverrides())
    }, "editBudget.validation")

    const save = action(async () => {
      const v = validation()
      if (v && !v.valid) {
        showToast(v.error!, 'error')
        return
      }
      settingsRoute.budgetInput.set(editingValue())
      await wrap(settingsRoute.saveBudget())
      edit.go({})
    }, "editBudget.save")

    return { editingValue, isOpen, open, close, save, validation }
  })

// /teams?editTeam=:id — team budget modal from all-teams grid
export const editAllTeamRoute = teamsRoute
  .reatomRoute({
    params({ editTeam }: { editTeam?: string }) {
      return editTeam ? { editTeam } : null
    },
  })
  .extend(edit => {
    const editingValue = atom("", "editAllTeam.value")

    const editingTeamId = computed(() => {
      return edit()?.editTeam ?? null
    }, "editAllTeam.teamId")

    const isOpen = computed(() => edit() !== null, "editAllTeam.isOpen")

    const editingDelta = computed(() => {
      const teamId = editingTeamId()
      if (!teamId) return null
      const currentBudget = settingsRoute.computedTeamBudgets()[teamId] ?? 1
      const newValue = Number(editingValue())
      return getTeamBudgetDelta(currentBudget, newValue)
    }, "editAllTeam.delta")

    const open = action((teamId: string) => {
      const current = settingsRoute.computedTeamBudgets()[teamId] ?? 1
      editingValue.set(String(Math.round(current)))
      edit.go({ editTeam: teamId })
    }, "editAllTeam.open")

    const close = action(() => {
      edit.go({})
    }, "editAllTeam.close")

    const save = action(async () => {
      const teamId = editingTeamId()
      if (!teamId) return
      const newValue = Number(editingValue())
      await saveTeamBudget(teamId, newValue)
      edit.go({})
    }, "editAllTeam.save")

    return { editingValue, editingTeamId, isOpen, editingDelta, open, close, save }
  })

// /teams/:teamId
export const teamRoute = teamsRoute
  .reatomRoute({
    path: ":teamId",
    async loader({ teamId }) {
      const params = filterParams()
      return await wrap(api.teams.users(teamId, params))
    },
    render() {
      return <TeamPage />
    },
  })
  .extend(route => {
    const selectedTeamId = computed(() => {
      return route()?.teamId ?? null
    }, "team.selectedId")

    const teamUsers = computed(() => {
      return route.loader.data() ?? ([] as TeamUser[])
    }, "team.users")

    return { selectedTeamId, teamUsers }
  })

// /teams/:teamId?edit — team budget modal from detail page
export const editTeamRoute = teamRoute
  .reatomRoute({
    params({ edit, teamId }: { edit?: string; teamId?: string }) {
      return edit === 'true' ? { edit, teamId: teamId ?? '' } : null
    },
  })
  .extend(edit => {
    const editingValue = atom("", "editTeam.value")

    const isOpen = computed(() => edit() !== null, "editTeam.isOpen")

    const editingTeamId = computed(() => {
      if (!isOpen()) return null
      return teamRoute.selectedTeamId()
    }, "editTeam.teamId")

    const editingDelta = computed(() => {
      const teamId = editingTeamId()
      if (!teamId) return null
      const currentBudget = settingsRoute.computedTeamBudgets()[teamId] ?? 1
      const newValue = Number(editingValue())
      return getTeamBudgetDelta(currentBudget, newValue)
    }, "editTeam.delta")

    const open = action(() => {
      const teamId = teamRoute.selectedTeamId()
      if (!teamId) return
      const current = settingsRoute.computedTeamBudgets()[teamId] ?? 1
      editingValue.set(String(Math.round(current)))
      edit.go({ teamId, edit: "true" })
    }, "editTeam.open")

    const close = action(() => {
      edit.inputParams.set(null)
    }, "editTeam.close")

    const save = action(async () => {
      const teamId = editingTeamId()
      if (!teamId) return
      const newValue = Number(editingValue())
      await saveTeamBudget(teamId, newValue)
      edit.inputParams.set(null)
    }, "editTeam.save")

    return { editingValue, editingTeamId, isOpen, editingDelta, open, close, save }
  })

// Shared save logic — throws on error, caller handles close
async function saveTeamBudget(teamId: string, newValue: number) {
  if (isNaN(newValue) || newValue <= 0) {
    await settingsRoute.removeTeamOverride(teamId)
    showToast(`Override removed for ${teamId} — using auto budget`)
    return
  }
  const value = Math.max(1, newValue)
  await settingsRoute.setTeamOverride(teamId, value)
  showToast(`Budget for ${teamId} saved: $${Math.round(value)}`)
}
