import { atom, action, computed, reatomRoute, wrap } from '@reatom/core'
import { api } from '../../shared/api/client'
import { filterParams } from '../../shared/filters/model'
import type { Team, TeamUser } from '@zendash/shared'

export const teamsRoute = reatomRoute({
  path: 'teams',
  async loader() {
    const params = filterParams()
    return await wrap(api.teams.list(params))
  },
}).extend((route) => {
  function data() {
    return route.loader.data() ?? ([] as Team[])
  }

  const teamsList = computed(() => data(), 'teams.list')

  const selectedTeamId = atom<string | null>(null, 'teams.selectedId')
  const teamUsers = atom<TeamUser[]>([], 'teams.users')

  const selectTeam = action(async (teamId: string | null) => {
    selectedTeamId.set(teamId)
    if (teamId) {
      const params = filterParams()
      const users = await wrap(api.teams.users(teamId, params))
      teamUsers.set(users)
    } else {
      teamUsers.set([])
    }
  }, 'teams.select')

  return { teamsList, selectedTeamId, teamUsers, selectTeam }
})
