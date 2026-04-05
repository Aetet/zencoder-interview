import { computed, reatomRoute, wrap, withChangeHook } from "@reatom/core"
import { api } from "../../shared/api/client"
import { knownTeamIds } from "./known-team-ids"
import { createLiveMode } from "../../shared/models/createLiveMode"
import type { Team } from "@zendash/shared"

export interface BudgetState {
  monthlyBudget: number
  teamOverrides: Record<string, number>
  autoBudget: number
  teamBudgets: { teamId: string; teamName: string; budget: number; spent: number }[]
}

const EMPTY_BUDGET: BudgetState = { monthlyBudget: 6000, teamOverrides: {}, autoBudget: 6, teamBudgets: [] }

const budgetSSE = createLiveMode<BudgetState>({
  url: "/api/budgets/live",
  name: "teams.budget",
})

export const budgetView = computed((): BudgetState => {
  return budgetSSE.data() ?? EMPTY_BUDGET
}, "teams.budgetView")

export const teamsRoute = reatomRoute({
  path: "teams",
  async loader() {
    return await wrap(api.teams.list({}))
  },
}).extend(route => {
  const teamsList = computed(() => {
    const teams = route.loader.data() ?? ([] as Team[])
    if (teams.length > 0) {
      knownTeamIds.set(teams.map(t => t.id))
    }
    return teams
  }, "teams.list")

  route.match.extend(
    withChangeHook(isMatch => {
      if (isMatch) budgetSSE.start()
      else budgetSSE.stop()
    }),
  )

  return { teamsList }
})
