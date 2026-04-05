import type { AlertEvent } from '@zendash/shared'
import type { MockSession, MockTeam } from './generator.js'

export interface AlertInput {
  sessions: MockSession[]
  teams: MockTeam[]
  budget: number
  thresholds: number[]
  teamBudgets: Record<string, number>
}

export function generateAlerts(input: AlertInput): AlertEvent[] {
  const { sessions, teams, budget, thresholds, teamBudgets } = input
  const events: AlertEvent[] = []
  let alertId = 1

  // Compute per-team costs
  const teamCosts = new Map<string, number>()
  for (const s of sessions) {
    teamCosts.set(s.teamId, (teamCosts.get(s.teamId) ?? 0) + s.cost)
  }

  const totalSpend = sessions.reduce((sum, s) => sum + s.cost, 0)

  // 1. Threshold crossings
  for (const threshold of [...thresholds].sort((a, b) => b - a)) {
    const thresholdAmount = budget * threshold / 100
    if (totalSpend >= thresholdAmount) {
      events.push({
        id: `alert-${alertId++}`,
        type: 'threshold_reached',
        severity: threshold >= 100 ? 'error' : threshold >= 90 ? 'warning' : 'info',
        title: `Org spend reached ${threshold}% of budget`,
        description: `$${totalSpend.toFixed(2)} of $${budget.toFixed(2)} monthly budget`,
        teamId: null,
        timestamp: recentDate(events.length),
      })
    }
  }

  // 2. Per-team budget exceeded
  for (const [teamId, cost] of teamCosts) {
    const teamBudget = teamBudgets[teamId]
    if (!teamBudget || cost <= teamBudget) continue
    const team = teams.find(t => t.id === teamId)
    events.push({
      id: `alert-${alertId++}`,
      type: 'budget_exceeded',
      severity: 'error',
      title: `${team?.name ?? teamId} exceeded budget`,
      description: `$${cost.toFixed(2)} spent vs $${teamBudget.toFixed(2)} allocated`,
      teamId,
      timestamp: recentDate(events.length),
    })
  }

  // 3. Spend spikes — daily cost > 2× 7-day daily average
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 86400000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  for (const team of teams.slice(0, 30)) {
    const teamSessions = sessions.filter(s => s.teamId === team.id)
    const todayCost = teamSessions
      .filter(s => new Date(s.timestamp) >= oneDayAgo)
      .reduce((sum, s) => sum + s.cost, 0)
    const weekCost = teamSessions
      .filter(s => new Date(s.timestamp) >= sevenDaysAgo)
      .reduce((sum, s) => sum + s.cost, 0)
    const weekDailyAvg = weekCost / 7

    if (weekDailyAvg > 0.01 && todayCost > weekDailyAvg * 2) {
      const pct = Math.round((todayCost / weekDailyAvg - 1) * 100)
      events.push({
        id: `alert-${alertId++}`,
        type: 'spend_spike',
        severity: 'warning',
        title: `${team.name} spend spike`,
        description: `+${pct}% above daily average ($${todayCost.toFixed(2)} vs $${weekDailyAvg.toFixed(2)} avg)`,
        teamId: team.id,
        timestamp: recentDate(events.length),
      })
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return events.slice(0, 25)
}

function recentDate(offset: number): string {
  const d = new Date()
  d.setHours(d.getHours() - offset * 6 - Math.floor(Math.random() * 6))
  return d.toISOString()
}
