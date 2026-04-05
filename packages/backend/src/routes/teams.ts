import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { pool, buildFilters, r2, num } from '../db.js'
import type { Team, TeamUser } from '@zendash/shared'

export const teams = new Hono()
  .get('/', zValidator('query', filterQuerySchema), async (c) => {
    const { range, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', model })

    // Per-team session stats
    const result = await pool.query(
      `SELECT dss.team_id, t.name,
              SUM(dss.total_sessions) AS sessions,
              SUM(dss.completed) AS completed,
              SUM(dss.total_cost) AS cost
       FROM daily_session_summary dss
       JOIN teams t ON t.id = dss.team_id
       ${f.where}
       GROUP BY dss.team_id, t.name`,
      f.params,
    )

    // Cache hit rates per team
    const cacheResult = await pool.query(
      `SELECT team_id, SUM(cache_read) AS cr, SUM(input_tokens) AS inp
       FROM daily_token_stats ${f.where}
       GROUP BY team_id`,
      f.params,
    )
    const cacheMap = new Map<string, { cr: number; inp: number }>()
    for (const r of cacheResult.rows) {
      cacheMap.set(r.team_id as string, { cr: num(r.cr), inp: num(r.inp) })
    }

    // 7-day trend per team
    const trendResult = await pool.query(
      `SELECT team_id, date, SUM(total_sessions) AS sessions
       FROM daily_session_summary
       WHERE date >= NOW() - INTERVAL '7 days'
       GROUP BY team_id, date
       ORDER BY team_id, date`,
    )
    const trendMap = new Map<string, number[]>()
    for (const r of trendResult.rows) {
      const tid = r.team_id as string
      if (!trendMap.has(tid)) trendMap.set(tid, [])
      trendMap.get(tid)!.push(num(r.sessions))
    }

    const teams: Team[] = result.rows.map((r) => {
      const sessions = num(r.sessions)
      const completed = num(r.completed)
      const cost = num(r.cost)
      const cache = cacheMap.get(r.team_id as string) ?? { cr: 0, inp: 0 }

      return {
        id: r.team_id as string,
        name: r.name as string,
        sessions,
        cost: r2(cost),
        completionRate: sessions > 0 ? completed / sessions : 0,
        costPerSession: completed > 0 ? r2(cost / completed) : 0,
        cacheHitRate: (cache.cr + cache.inp) > 0 ? cache.cr / (cache.cr + cache.inp) : 0,
        trend: trendMap.get(r.team_id as string) ?? [],
      }
    })

    return c.json(teams)
  })

  .get('/:id/users', zValidator('query', filterQuerySchema), async (c) => {
    const teamId = c.req.param('id')

    // Verify team exists
    const teamCheck = await pool.query('SELECT id FROM teams WHERE id = $1', [teamId])
    if (teamCheck.rows.length === 0) return c.json({ error: 'Team not found' }, 404)

    const { range, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', team_id: teamId, model })

    const result = await pool.query(
      `SELECT u.id, u.email,
              COALESCE(SUM(tus.sessions), 0) AS sessions,
              COALESCE(SUM(tus.cost), 0) AS cost,
              COALESCE(SUM(tus.completed), 0) AS completed,
              MAX(tus.last_active) AS last_active
       FROM users u
       LEFT JOIN team_user_stats tus ON tus.user_id = u.id
         AND tus.date >= NOW() - INTERVAL '${f.where.includes('30 days') ? '30 days' : '30 days'}'
       WHERE u.team_id = $1
       GROUP BY u.id, u.email`,
      [teamId],
    )

    const users: TeamUser[] = result.rows.map((r) => {
      const sessions = num(r.sessions)
      const completed = num(r.completed)
      const cost = num(r.cost)
      return {
        id: r.id as string,
        email: r.email as string,
        sessions,
        cost: r2(cost),
        completionRate: sessions > 0 ? completed / sessions : 0,
        costPerSession: completed > 0 ? r2(cost / completed) : 0,
        lastActive: r.last_active ? (r.last_active as Date).toISOString() : new Date().toISOString(),
      }
    })

    return c.json(users)
  })
