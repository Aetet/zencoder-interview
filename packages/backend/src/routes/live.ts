import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { streamSSE } from 'hono/streaming'
import { pool, buildFilters, r2, num } from '../db.js'
import type { LiveUpdate, DailySessionTrend, DailyCostTrend } from '@zendash/shared'

const POLL_INTERVAL_MS = 5_000

export const live = new Hono()
  .get('/live', zValidator('query', filterQuerySchema), (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const params = { range: range ?? '30d', team_id, model }

    return streamSSE(c, async (stream) => {
      let id = 0

      while (true) {
        const update = await fetchLiveData(params)

        await stream.writeSSE({
          data: JSON.stringify(update),
          event: 'update',
          id: String(id++),
        })

        await stream.sleep(POLL_INTERVAL_MS)
      }
    })
  })

async function fetchLiveData(params: {
  range?: string
  team_id?: string
  model?: string
}): Promise<LiveUpdate> {
  const f = buildFilters(params)

  // Totals
  const totalsResult = await pool.query(
    `SELECT COALESCE(SUM(total_sessions), 0) AS total,
            COALESCE(SUM(completed), 0) AS completed,
            COALESCE(SUM(total_cost), 0) AS cost,
            COALESCE(SUM(active_users), 0) AS users
     FROM daily_session_summary ${f.where}`,
    f.params,
  )
  const t = totalsResult.rows[0]
  const totalSessions = num(t.total)
  const completed = num(t.completed)
  const totalCost = num(t.cost)
  const activeUsers = num(t.users)

  // Daily session trend
  const trendResult = await pool.query(
    `SELECT date, SUM(total_sessions) AS sessions, SUM(completed) AS completed,
            SUM(errored) AS errored, SUM(cancelled) AS cancelled
     FROM daily_session_summary ${f.where}
     GROUP BY date ORDER BY date`,
    f.params,
  )
  const trend: DailySessionTrend[] = trendResult.rows.map((r) => ({
    date: (r.date as Date).toISOString().slice(0, 10),
    sessions: num(r.sessions),
    completed: num(r.completed),
    errored: num(r.errored),
    cancelled: num(r.cancelled),
  }))

  // Daily cost trend
  const costTrendResult = await pool.query(
    `SELECT date, SUM(total_cost) AS cost
     FROM daily_session_summary ${f.where}
     GROUP BY date ORDER BY date`,
    f.params,
  )
  const costTrend: DailyCostTrend[] = costTrendResult.rows.map((r) => ({
    date: (r.date as Date).toISOString().slice(0, 10),
    cost: r2(num(r.cost)),
  }))

  return {
    totalSessions,
    totalCost: r2(totalCost),
    completionRate: totalSessions > 0 ? completed / totalSessions : 0,
    activeUsers,
    costPerSession: completed > 0 ? r2(totalCost / completed) : 0,
    trend,
    costTrend,
  }
}
