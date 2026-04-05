import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { pool, buildFilters, rangeToInterval, r2, num } from '../db.js'
import type { SessionSummary, DailySessionTrend, DailyCostTrend } from '@zendash/shared'

export const sessions = new Hono()
  .get('/summary', zValidator('query', filterQuerySchema), async (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', team_id, model })

    // Totals from daily_session_summary
    const totalsResult = await pool.query(
      `SELECT
        COALESCE(SUM(total_sessions), 0) AS total_sessions,
        COALESCE(SUM(completed), 0) AS completed,
        COALESCE(SUM(total_cost), 0) AS total_cost
      FROM daily_session_summary ${f.where}`,
      f.params,
    )
    const t = totalsResult.rows[0]
    const totalSessions = num(t.total_sessions)
    const completedSessions = num(t.completed)
    const totalCost = num(t.total_cost)

    // Distinct active users from team_user_stats
    const activeResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS cnt
       FROM team_user_stats
       WHERE date >= NOW() - INTERVAL '${rangeToInterval(range ?? '30d')}'`,
    )
    const activeUsers = num(activeResult.rows[0].cnt)

    // Total users
    const usersResult = await pool.query('SELECT COUNT(*) AS cnt FROM users')
    const totalUsers = num(usersResult.rows[0].cnt)

    // Daily session trend
    const trendResult = await pool.query(
      `SELECT date, SUM(total_sessions) AS sessions, SUM(completed) AS completed,
              SUM(errored) AS errored, SUM(cancelled) AS cancelled
       FROM daily_session_summary ${f.where}
       GROUP BY date ORDER BY date`,
      f.params,
    )
    const trend: DailySessionTrend[] = trendResult.rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      sessions: num(r.sessions),
      completed: num(r.completed),
      errored: num(r.errored),
      cancelled: num(r.cancelled),
    }))

    // Cost trend
    const costTrendResult = await pool.query(
      `SELECT date, SUM(total_cost) AS cost
       FROM daily_session_summary ${f.where}
       GROUP BY date ORDER BY date`,
      f.params,
    )
    const costTrend: DailyCostTrend[] = costTrendResult.rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      cost: r2(num(r.cost)),
    }))

    const result: SessionSummary = {
      totalSessions,
      completedSessions,
      completionRate: totalSessions > 0 ? completedSessions / totalSessions : 0,
      activeUsers,
      totalUsers,
      adoptionRate: totalUsers > 0 ? activeUsers / totalUsers : 0,
      costPerSession: completedSessions > 0 ? totalCost / completedSessions : 0,
      totalCost: r2(totalCost),
      trend,
      costTrend,
    }

    return c.json(result)
  })
