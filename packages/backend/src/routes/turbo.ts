import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { DailySessionTrend, DailyCostTrend, LiveUpdate, Team, Insight } from '@zendash/shared'

const TURBO_INTERVAL_MS = 67 // ~15 updates/sec

function rf(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

const TEAM_NAMES = [
  'Backend', 'Frontend', 'Platform', 'Data', 'Mobile', 'DevOps',
  'Infra', 'Auth', 'Payments', 'Search', 'ML', 'Analytics',
  'Billing', 'Onboarding', 'Notifications', 'Integrations',
  'Core', 'Growth', 'Security', 'Compliance', 'Tooling', 'DX',
  'API', 'Web', 'iOS', 'Android', 'Desktop', 'CLI', 'SDK', 'Docs',
]

function baseTeams(): Team[] {
  return TEAM_NAMES.map(name => ({
    id: name.toLowerCase(),
    name,
    sessions: Math.round(rf(100, 600)),
    cost: r2(rf(10, 300)),
    completionRate: rf(0.75, 0.95),
    costPerSession: r2(rf(0.02, 0.80)),
    cacheHitRate: rf(0.15, 0.55),
    trend: Array.from({ length: 7 }, () => Math.round(rf(5, 30))),
  }))
}

function baseTrend(): { trend: DailySessionTrend[]; costTrend: DailyCostTrend[] } {
  const now = new Date()
  const trend: DailySessionTrend[] = []
  const costTrend: DailyCostTrend[] = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const sessions = Math.round(rf(250, 350))
    const completed = Math.round(sessions * rf(0.82, 0.9))
    const errored = Math.round(sessions * rf(0.07, 0.13))
    const cancelled = sessions - completed - errored

    trend.push({ date, sessions, completed, errored, cancelled })
    costTrend.push({ date, cost: r2(rf(100, 200)) })
  }

  return { trend, costTrend }
}

export const turbo = new Hono()
  .get('/live', (c) => {
    return streamSSE(c, async (stream) => {
      let id = 0
      const base = baseTrend()
      const teams = baseTeams()

      let totalSessions = Math.round(rf(8000, 10000))
      let totalCost = r2(rf(3000, 5000))

      while (true) {
        const v = () => 1 + (Math.random() - 0.5) * 0.20

        totalSessions += Math.round(rf(1, 5))
        totalCost = r2(totalCost + rf(0.01, 0.5))

        const completionRate = rf(0.82, 0.9)
        const activeUsers = Math.round(rf(1800, 2500))
        const costPerSession = totalSessions > 0 ? r2(totalCost / totalSessions) : 0

        const trend: DailySessionTrend[] = base.trend.map((d) => ({
          ...d,
          sessions: Math.round(d.sessions * v()),
          completed: Math.round(d.completed * v()),
          errored: Math.round(d.errored * v()),
        }))

        const costTrend: DailyCostTrend[] = base.costTrend.map((d) => ({
          date: d.date,
          cost: r2(d.cost * v()),
        }))

        // Jitter each team's metrics
        const turboTeams: Team[] = teams.map(t => ({
          ...t,
          sessions: Math.round(t.sessions * v()),
          cost: r2(t.cost * v()),
          completionRate: Math.min(1, t.completionRate * v()),
          costPerSession: r2(t.costPerSession * v()),
        }))

        // Top cost insight
        const sorted = [...turboTeams].sort((a, b) => b.cost - a.cost)
        const top = sorted[0]
        const avgCost = turboTeams.reduce((s, t) => s + t.cost, 0) / turboTeams.length
        const pctAbove = avgCost > 0 ? Math.round(((top.cost - avgCost) / avgCost) * 100) : 0

        const insights: Insight[] = [
          {
            type: 'highCostTeam',
            title: `${top.name} spent $${Math.round(top.cost)} — ${Math.abs(pctAbove)}% above avg`,
            description: `Team "${top.name}" has the highest cost this period`,
            severity: 'warning',
            link: `/costs?team=${top.id}`,
          },
        ]

        const update: LiveUpdate & { teams: Team[]; insights: Insight[] } = {
          totalSessions,
          totalCost,
          completionRate,
          activeUsers,
          costPerSession,
          trend,
          costTrend,
          teams: turboTeams,
          insights,
        }

        await stream.writeSSE({
          data: JSON.stringify(update),
          event: 'update',
          id: String(id++),
        })

        await stream.sleep(TURBO_INTERVAL_MS)
      }
    })
  })
