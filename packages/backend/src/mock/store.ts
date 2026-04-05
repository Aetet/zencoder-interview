import { generateMockData, type MockTeam, type MockUser, type MockSession } from './generator.js'

interface BudgetConfig {
  monthlyBudget: number
  thresholds: number[]
  teamOverrides: Record<string, number>
}

interface Store {
  teams: MockTeam[]
  users: MockUser[]
  sessions: MockSession[]
  budget: BudgetConfig
}

const data = generateMockData()

export const store: Store = {
  teams: data.teams,
  users: data.users,
  sessions: data.sessions,
  budget: {
    monthlyBudget: 6000,
    thresholds: [50, 75, 90, 100],
    teamOverrides: {},
  },
}

export function filterSessions(params: {
  range?: string
  team_id?: string
  user_id?: string
  model?: string
}): MockSession[] {
  let filtered = store.sessions

  if (params.range) {
    const now = new Date()
    let daysBack = 30
    if (params.range === 'today') daysBack = 1
    else if (params.range === '7d') daysBack = 7
    else if (params.range === '30d') daysBack = 30
    else if (params.range === '90d') daysBack = 90

    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - daysBack)
    filtered = filtered.filter((s) => new Date(s.timestamp) >= cutoff)
  }

  if (params.team_id) {
    filtered = filtered.filter((s) => s.teamId === params.team_id)
  }
  if (params.user_id) {
    filtered = filtered.filter((s) => s.userId === params.user_id)
  }
  if (params.model) {
    filtered = filtered.filter((s) => s.model === params.model)
  }

  return filtered
}

/** Compute per-team budget using auto-distribution */
export function getTeamBudgets(): Record<string, number> {
  const overrides = store.budget.teamOverrides
  const teamIds = store.teams.map(t => t.id)
  const totalBudget = store.budget.monthlyBudget
  const overrideSum = Object.values(overrides).reduce((s, v) => s + v, 0)
  const autoTeams = teamIds.filter(id => !(id in overrides))
  const remaining = totalBudget - overrideSum
  const autoBudget = autoTeams.length > 0 ? Math.max(1, remaining / autoTeams.length) : 0

  const result: Record<string, number> = {}
  for (const id of teamIds) {
    result[id] = id in overrides ? overrides[id] : Math.round(autoBudget * 100) / 100
  }
  return result
}
