import { atom, action } from '@reatom/core'
import { api } from '../../shared/api/client'
import { filterParams } from '../../shared/filters/model'
import type { Team, TeamUser } from '@zendash/shared'

export const teamsList = atom<Team[]>([], 'teams.list')
export const selectedTeamId = atom<string | null>(null, 'teams.selectedId')
export const teamUsers = atom<TeamUser[]>([], 'teams.users')
export const teamsLoading = atom(true, 'teams.loading')

export const fetchTeams = action(async () => {
  teamsLoading.set(true)
  try {
    const params = filterParams()
    const teams = await api.teams.list(params)
    teamsList.set(teams)
  } finally {
    teamsLoading.set(false)
  }
}, 'teams.fetch')

export const selectTeam = action(async (teamId: string | null) => {
  selectedTeamId.set(teamId)
  if (teamId) {
    const params = filterParams()
    const users = await api.teams.users(teamId, params)
    teamUsers.set(users)
  } else {
    teamUsers.set([])
  }
}, 'teams.select')
