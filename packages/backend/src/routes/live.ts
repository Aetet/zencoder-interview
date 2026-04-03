import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { store, filterSessions } from '../mock/store.js'
import type { DailySessionTrend, DailyCostTrend, Team, Insight } from '@zendash/shared'

export const live = new Hono()

live.get('/live', (c) => {
  const params = {
    range: c.req.query('range') ?? '30d',
    team_id: c.req.query('team_id'),
    model: c.req.query('model'),
  }

  return streamSSE(c, async (stream) => {
    let id = 0

    // Pre-compute base data once
    const filtered = filterSessions(params)
    const completed = filtered.filter((s) => s.status === 'completed')
    const baseTotalCost = filtered.reduce((sum, s) => sum + s.cost, 0)
    const uniqueUsers = new Set(filtered.map((s) => s.userId))

    // Pre-compute base daily trends
    const baseDayMap = new Map<string, DailySessionTrend>()
    for (const s of filtered) {
      const date = s.timestamp.slice(0, 10)
      const e = baseDayMap.get(date) ?? { date, sessions: 0, completed: 0, errored: 0, cancelled: 0 }
      e.sessions++
      if (s.status === 'completed') e.completed++
      else if (s.status === 'error') e.errored++
      else e.cancelled++
      baseDayMap.set(date, e)
    }
    const baseTrend = Array.from(baseDayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    const baseCostMap = new Map<string, number>()
    for (const s of filtered) {
      const date = s.timestamp.slice(0, 10)
      baseCostMap.set(date, (baseCostMap.get(date) ?? 0) + s.cost)
    }
    const baseCostTrend = Array.from(baseCostMap.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Pre-compute base teams
    const baseTeams = store.teams.map((t) => {
      const ts = filtered.filter((s) => s.teamId === t.id)
      const tc = ts.filter((s) => s.status === 'completed')
      const cost = ts.reduce((sum, s) => sum + s.cost, 0)
      let cr = 0, inp = 0
      for (const s of ts) { cr += s.cacheRead; inp += s.inputTokens }
      return {
        id: t.id, name: t.name,
        sessions: ts.length, cost,
        completionRate: ts.length > 0 ? tc.length / ts.length : 0,
        costPerSession: tc.length > 0 ? cost / tc.length : 0,
        cacheHitRate: (cr + inp) > 0 ? cr / (cr + inp) : 0,
        trend: [] as number[],
      }
    })

    // Pre-compute base insights data
    const avgTeamCost = baseTotalCost / store.teams.length
    const orgCacheRead = filtered.reduce((s, x) => s + x.cacheRead, 0)
    const orgCacheInput = filtered.reduce((s, x) => s + x.cacheRead + x.inputTokens, 0)
    const orgRate = orgCacheInput > 0 ? orgCacheRead / orgCacheInput : 0

    const teamCacheMap = new Map<string, { cr: number; inp: number }>()
    for (const s of filtered) {
      const e = teamCacheMap.get(s.teamId) ?? { cr: 0, inp: 0 }
      e.cr += s.cacheRead; e.inp += s.inputTokens
      teamCacheMap.set(s.teamId, e)
    }
    let worstTeam = store.teams[0], worstRate = 1
    for (const t of store.teams) {
      const d = teamCacheMap.get(t.id) ?? { cr: 0, inp: 0 }
      const rate = (d.cr + d.inp) > 0 ? d.cr / (d.cr + d.inp) : 0
      if (rate < worstRate) { worstTeam = t; worstRate = rate }
    }
    const expensiveSession = [...filtered].sort((a, b) => b.cost - a.cost)[0]
    const avgCost = baseTotalCost / (filtered.length || 1)

    // Stream at ~15 updates/second (67ms interval)
    while (true) {
      const v = () => 1 + (Math.random() - 0.5) * 0.06

      const trend: DailySessionTrend[] = baseTrend.map((d) => ({
        ...d,
        sessions: Math.round(d.sessions * v()),
        completed: Math.round(d.completed * v()),
        errored: Math.round(d.errored * v()),
        cancelled: d.cancelled,
      }))

      const costTrend: DailyCostTrend[] = baseCostTrend.map((d) => ({
        date: d.date,
        cost: Math.round(d.cost * v() * 100) / 100,
      }))

      const teams: Team[] = baseTeams.map((t) => ({
        ...t,
        sessions: Math.round(t.sessions * v()),
        cost: Math.round(t.cost * v() * 100) / 100,
        costPerSession: Math.round(t.costPerSession * v() * 100) / 100,
      }))

      const sortedTeams = [...teams].sort((a, b) => b.cost - a.cost)
      const topTeam = sortedTeams[0]
      const pctAbove = avgTeamCost > 0 ? Math.round(((topTeam.cost - avgTeamCost * v()) / (avgTeamCost * v())) * 100) : 0

      const insights: Insight[] = [
        {
          type: 'highCostTeam',
          title: `${topTeam.name} spent $${Math.round(topTeam.cost)} — ${Math.abs(pctAbove)}% above avg`,
          description: `Team "${topTeam.name}" has the highest cost this period`,
          severity: 'warning',
          link: `/costs?team=${topTeam.id}`,
        },
        {
          type: 'lowCacheRate',
          title: `${worstTeam.name} cache hit rate: ${Math.round(worstRate * 100)}% vs ${Math.round(orgRate * 100)}% avg`,
          description: 'Low cache utilization may be increasing costs',
          severity: 'error',
          link: `/costs?team=${worstTeam.id}`,
        },
        ...(expensiveSession ? [{
          type: 'expensiveSession' as const,
          title: `Session ${expensiveSession.id.slice(0, 8)} cost $${(expensiveSession.cost * v()).toFixed(2)} — ${Math.round(expensiveSession.cost / avgCost)}x avg`,
          description: 'Anomalous session detected; review recommended',
          severity: 'info' as const,
          link: '/overview',
        }] : []),
      ]

      await stream.writeSSE({
        data: JSON.stringify({
          totalSessions: Math.round(filtered.length * v()),
          totalCost: Math.round(baseTotalCost * v() * 100) / 100,
          completionRate: filtered.length > 0 ? (completed.length / filtered.length) * v() : 0,
          activeUsers: uniqueUsers.size,
          costPerSession: completed.length > 0 ? Math.round((baseTotalCost / completed.length) * v() * 100) / 100 : 0,
          trend,
          costTrend,
          teams,
          insights,
        }),
        event: 'update',
        id: String(id++),
      })

      await stream.sleep(67)
    }
  })
})
