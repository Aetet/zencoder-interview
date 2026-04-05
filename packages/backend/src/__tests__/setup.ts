/**
 * Test setup: replaces the real PG pool with a mock that returns
 * deterministic data. The mock inspects SQL to return appropriate rows.
 */
import { vi, beforeAll, afterAll } from 'vitest'
import { setPool } from '../db.js'

const today = new Date()
const dates = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(today)
  d.setDate(d.getDate() - (29 - i))
  return d
})

const TEAMS = Array.from({ length: 1000 }, (_, i) => {
  const name = i === 0 ? 'Backend' : i === 1 ? 'Frontend' : `Team-${i}`
  return { id: name.toLowerCase(), name }
})

const USERS = TEAMS.flatMap((t, ti) => {
  const count = 3
  return Array.from({ length: count }, (_, ui) => {
    const idx = ti * count + ui + 1
    return { id: `user-${idx}`, email: `user${idx}@acme.com`, team_id: t.id }
  })
})

/** Mutable budget state */
let budgetState = {
  monthly_budget: '6000',
  thresholds: [50, 75, 90, 100],
  team_overrides: {} as Record<string, number>,
}

export function resetBudget() {
  budgetState = {
    monthly_budget: '6000',
    thresholds: [50, 75, 90, 100],
    team_overrides: {},
  }
}

function has(q: string, ...terms: string[]): boolean {
  return terms.every(t => q.includes(t))
}

function makeRows(sql: string, params: unknown[]): unknown[] {
  const q = sql.replace(/\s+/g, ' ').toLowerCase()
  const allStringParams = params.filter((p): p is string => typeof p === 'string')
  const teamFilter = allStringParams.find(p => TEAMS.some(t => t.id === p))
  const hasTeamParam = allStringParams.length > 0 && q.includes('team_id')
  const isNonexistentTeam = hasTeamParam && !teamFilter
  const isShortRange = q.includes("'7 days'") || q.includes("'1 day'")

  // --- Budget ---
  if (has(q, 'budget_config') && has(q, 'select')) return [budgetState]
  if (has(q, 'budget_config') && has(q, 'update')) {
    if (params[0] != null) budgetState.monthly_budget = String(params[0])
    if (params[1] != null) budgetState.team_overrides = JSON.parse(params[1] as string)
    return []
  }

  // --- Count queries ---
  if (has(q, 'count(distinct user_id)', 'team_user_stats')) return [{ cnt: 2100 }]
  if (has(q, 'count', 'from teams')) return [{ cnt: TEAMS.length }]
  if (has(q, 'count', 'from users')) return [{ cnt: USERS.length }]

  // --- Team lookup by id ---
  if (has(q, 'from teams', 'where id')) {
    const team = TEAMS.find(t => t.id === params[0])
    return team ? [team] : []
  }

  // --- Alerts ---
  if (has(q, 'from alerts_log')) {
    return [{
      id: 'alert-1', type: 'threshold_reached', severity: 'warning',
      title: '75% of budget used', description: 'Org spent 75%',
      team_id: null, ts: today,
    }]
  }

  // --- Quality stats ---
  if (has(q, 'daily_quality_stats')) {
    return [{
      total: 9000, completed: 7650,
      tool_calls: 45000, tool_errors: 4500,
      errors_api: 360, errors_tool: 270,
      errors_permission: 135, errors_runtime: 135,
    }]
  }

  // --- Team users (left join) ---
  if (has(q, 'team_user_stats') || has(q, 'left join')) {
    const tid = params[0] as string
    return USERS.filter(u => u.team_id === tid).map(u => ({
      id: u.id, email: u.email,
      sessions: 10, cost: '0.42', completed: 9, last_active: today,
    }))
  }

  // --- Session summary: daily trend with errored/cancelled ---
  if (has(q, 'daily_session_summary') && has(q, 'group by') && has(q, 'errored')) {
    return dates.map(d => ({
      date: d, sessions: 300, completed: 255, errored: 30, cancelled: 15,
    }))
  }

  // --- Session summary: cost trend (date + cost only) ---
  if (has(q, 'daily_session_summary') && has(q, 'sum(total_cost)') && has(q, 'group by') && !has(q, 'team_id,')) {
    return dates.map(d => ({ date: d, cost: '1.50' }))
  }

  // --- Session summary: month spend (date_trunc) ---
  if (has(q, 'daily_session_summary') && has(q, "date_trunc") && !has(q, 'group by')) {
    return [{ spend: '2400.00' }]
  }

  // --- Session summary: per-team month spend ---
  if (has(q, 'daily_session_summary') && has(q, "date_trunc") && has(q, 'group by')) {
    return TEAMS.slice(0, 20).map(t => ({ team_id: t.id, team_name: t.name, spent: '2.40' }))
  }

  // --- Session summary: 7-day trend for teams (no join, just team_id+date) ---
  if (has(q, 'daily_session_summary') && has(q, "'7 days'") && has(q, 'group by') && !has(q, 'join teams')) {
    const result: unknown[] = []
    for (const t of TEAMS.slice(0, 10)) {
      for (let i = 0; i < 7; i++) {
        result.push({ team_id: t.id, date: dates[dates.length - 7 + i], sessions: 8 + i })
      }
    }
    return result
  }

  // --- Session summary: teams with join ---
  if (has(q, 'daily_session_summary') && has(q, 'join teams') && has(q, 'group by')) {
    const teams = teamFilter ? TEAMS.filter(t => t.id === teamFilter) : TEAMS.slice(0, 10)
    const sessPerTeam = isShortRange ? 2 : 9
    return teams.map(t => ({
      team_id: t.id, name: t.name,
      sessions: sessPerTeam, completed: sessPerTeam - 1, cost: isShortRange ? '0.01' : '0.045',
    }))
  }

  // --- Session summary: totals (no group by) ---
  if (has(q, 'daily_session_summary') && has(q, 'sum(') && !has(q, 'group by')) {
    if (isNonexistentTeam) {
      return [{ total: 0, total_sessions: 0, completed: 0, cost: '0', users: 0, active_users: 0, cnt: 0 }]
    }
    const baseSessions = teamFilter ? 30 : 9000
    const sessions = isShortRange ? Math.round(baseSessions * 0.23) : baseSessions
    return [{
      total: sessions, total_sessions: sessions,
      completed: Math.round(sessions * 0.85),
      cost: teamFilter ? '1.50' : (isShortRange ? '10.00' : '45.00'),
      users: teamFilter ? 3 : 2100,
      active_users: teamFilter ? 3 : 2100,
      cnt: Math.round(sessions * 0.85),
    }]
  }

  // --- Token stats: by team with join (cost) ---
  if (has(q, 'daily_token_stats') && has(q, 'join teams') && has(q, 'total_cost')) {
    const teams = teamFilter ? TEAMS.filter(t => t.id === teamFilter) : TEAMS.slice(0, 3)
    // 3 teams, costs match total: 0.1659 + 1.506 + 2.445 ≈ 4.12
    const costs = ['1.37', '1.37', '1.37']
    return teams.map((t, i) => ({ team_id: t.id, team_name: t.name, cost: costs[i] ?? '1.37' }))
  }

  // --- Token stats: by team with join (cache) --- used by /teams and /costs/cache
  if (has(q, 'daily_token_stats') && has(q, 'join teams') && has(q, 'cache_read')) {
    const teams = teamFilter ? TEAMS.filter(t => t.id === teamFilter) : (isShortRange ? TEAMS.slice(0, 2) : TEAMS.slice(0, 3))
    return teams.map(t => ({ team_id: t.id, team_name: t.name, cr: '3000', inp: '8000' }))
  }

  // --- Token stats: total cost ---
  if (has(q, 'daily_token_stats') && has(q, 'sum(total_cost)') && !has(q, 'group by')) {
    // Must match tokenTypeSum (1.25+2.5+0.35+0.01=4.11) within 0.5
    return [{ total: '4.11' }]
  }

  // --- Token stats: org cache totals ---
  if (has(q, 'daily_token_stats') && has(q, 'sum(cache_read)') && !has(q, 'group by')) {
    return [{ cr: '150000', inp: '400000' }]
  }

  // --- Token stats: by model ---
  if (has(q, 'daily_token_stats') && has(q, 'group by model') && !has(q, 'group by date')) {
    return [
      { model: 'haiku', cost: '5.00', input: '200000', output: '80000', cache_c: '50000', cache_r: '30000' },
      { model: 'sonnet', cost: '25.00', input: '150000', output: '60000', cache_c: '40000', cache_r: '20000' },
      { model: 'opus', cost: '15.00', input: '50000', output: '20000', cache_c: '10000', cache_r: '5000' },
    ]
  }

  // --- Token stats: daily by model ---
  if (has(q, 'daily_token_stats') && has(q, 'group by date, model')) {
    return dates.map(d => ({
      date: d, model: 'sonnet', input: '5000', output: '2000', cache_c: '1500', cache_r: '800',
    }))
  }

  // --- Token stats: daily cache trend ---
  if (has(q, 'daily_token_stats') && has(q, 'group by') && has(q, 'date') && has(q, 'cache_read')) {
    return dates.map(d => ({ date: d, cr: '5000', inp: '13000' }))
  }

  // --- Token stats: savings by model ---
  if (has(q, 'daily_token_stats') && has(q, 'group by') && has(q, 'model') && has(q, 'sum(cache_read)')) {
    return [{ model: 'sonnet', cr: '150000' }]
  }

  // Fallback
  console.warn('[mock-pool] unmatched query:', q.slice(0, 120))
  return []
}

const mockPool = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    const rows = makeRows(sql, params ?? [])
    return { rows, rowCount: rows.length }
  }),
  connect: vi.fn(),
  end: vi.fn(),
} as unknown as import('pg').Pool

beforeAll(() => {
  setPool(mockPool)
})

afterAll(() => {
  vi.restoreAllMocks()
})
