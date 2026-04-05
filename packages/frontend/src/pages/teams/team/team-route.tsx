import { computed, wrap } from "@reatom/core"
import { teamsRoute } from "../teams-route"
import { api } from "../../../shared/api/client"
import type { TeamUser, BudgetData } from "@zendash/shared"

export const teamRoute = teamsRoute
  .reatomRoute({
    path: ":teamId",
    async loader({ teamId }) {
      const [users, budgetData] = await Promise.all([wrap(api.teams.users(teamId, {})), wrap(api.costs.budget())])
      return { users, budgetData }
    },
  })
  .extend(route => {
    const selectedTeamId = computed(() => route()?.teamId ?? null, "team.selectedId")

    const loaderData = () =>
      route.loader.data() ?? {
        users: [] as TeamUser[],
        budgetData: {
          teamBudgets: [],
          monthlyBudget: 0,
          currentSpend: 0,
          projected: 0,
          percentUsed: 0,
          thresholds: [],
        } as BudgetData,
      }

    const teamUsers = computed(() => loaderData().users, "team.users")

    const teamBudgetAllocation = computed(() => {
      const teamId = selectedTeamId()
      if (!teamId) return 0
      const entry = loaderData().budgetData.teamBudgets.find(t => t.teamId === teamId)
      return entry?.budget ?? 0
    }, "team.budgetAllocation")

    return { selectedTeamId, teamUsers, teamBudgetAllocation }
  })
