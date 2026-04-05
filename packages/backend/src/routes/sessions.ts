import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { store, filterSessions } from '../mock/store.js'
import type { SessionSummary, DailySessionTrend, DailyCostTrend } from '@zendash/shared'

export const sessions = new Hono()
  .get('/summary', zValidator('query', filterQuerySchema), (c) => {
    const { range, team_id, user_id, model } = c.req.valid('query')
    const params = {
      range: range ?? '30d',
      team_id,
      user_id,
      model,
    }

    const filtered = filterSessions(params)
    const completed = filtered.filter((s) => s.status === 'completed')
    const totalCost = filtered.reduce((sum, s) => sum + s.cost, 0)
    const uniqueUsers = new Set(filtered.map((s) => s.userId))

    // Daily trend
    const byDay = new Map<string, DailySessionTrend>()
    for (const s of filtered) {
      const date = s.timestamp.slice(0, 10)
      const entry = byDay.get(date) ?? { date, sessions: 0, completed: 0, errored: 0, cancelled: 0 }
      entry.sessions++
      if (s.status === 'completed') entry.completed++
      else if (s.status === 'error') entry.errored++
      else entry.cancelled++
      byDay.set(date, entry)
    }

    const costByDay = new Map<string, number>()
    for (const s of filtered) {
      const date = s.timestamp.slice(0, 10)
      costByDay.set(date, (costByDay.get(date) ?? 0) + s.cost)
    }

    const trend = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
    const costTrend: DailyCostTrend[] = Array.from(costByDay.entries())
      .map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const result: SessionSummary = {
      totalSessions: filtered.length,
      completedSessions: completed.length,
      completionRate: filtered.length > 0 ? completed.length / filtered.length : 0,
      activeUsers: uniqueUsers.size,
      totalUsers: store.users.length,
      adoptionRate: store.users.length > 0 ? uniqueUsers.size / store.users.length : 0,
      costPerSession: completed.length > 0 ? totalCost / completed.length : 0,
      totalCost: Math.round(totalCost * 100) / 100,
      trend,
      costTrend,
    }

    return c.json(result)
  })
