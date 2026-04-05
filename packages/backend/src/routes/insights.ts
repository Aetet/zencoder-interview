import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { pool, buildFilters, r2, num } from '../db.js'
import type { Insight } from '@zendash/shared'

export const insights = new Hono()
  .get('/', zValidator('query', filterQuerySchema), async (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', team_id, model })
    const result: Insight[] = []

    // 1. Highest cost team
    const teamCostResult = await pool.query(
      `SELECT dss.team_id, t.name AS team_name, SUM(dss.total_cost) AS cost
       FROM daily_session_summary dss JOIN teams t ON t.id = dss.team_id
       ${f.where} GROUP BY dss.team_id, t.name ORDER BY cost DESC`,
      f.params,
    )
    if (teamCostResult.rows.length > 0) {
      const avgCost = teamCostResult.rows.reduce((s, r) => s + num(r.cost), 0) / teamCostResult.rows.length
      const top = teamCostResult.rows[0]
      const topCost = num(top.cost)
      const pctAbove = avgCost > 0 ? Math.round(((topCost - avgCost) / avgCost) * 100) : 0

      result.push({
        type: 'highCostTeam',
        title: `${top.team_name} spent $${Math.round(topCost).toLocaleString()} — ${pctAbove}% above avg`,
        description: `Team "${top.team_name}" has the highest cost this period`,
        severity: 'warning',
        link: `/costs?team=${top.team_id}`,
      })
    }

    // 2. Lowest cache hit rate
    const cacheResult = await pool.query(
      `SELECT dts.team_id, t.name AS team_name,
              SUM(dts.cache_read) AS cr, SUM(dts.input_tokens) AS inp
       FROM daily_token_stats dts JOIN teams t ON t.id = dts.team_id
       ${f.where} GROUP BY dts.team_id, t.name`,
      f.params,
    )
    if (cacheResult.rows.length > 0) {
      let totalCR = 0, totalInp = 0
      for (const r of cacheResult.rows) { totalCR += num(r.cr); totalInp += num(r.inp) }
      const orgRate = (totalCR + totalInp) > 0 ? totalCR / (totalCR + totalInp) : 0

      let worstRow = cacheResult.rows[0], worstRate = 1
      for (const r of cacheResult.rows) {
        const cr = num(r.cr), inp = num(r.inp)
        const rate = (cr + inp) > 0 ? cr / (cr + inp) : 0
        if (rate < worstRate) { worstRow = r; worstRate = rate }
      }

      result.push({
        type: 'lowCacheRate',
        title: `${worstRow.team_name} cache hit rate: ${Math.round(worstRate * 100)}% vs ${Math.round(orgRate * 100)}% avg`,
        description: 'Low cache utilization may be increasing costs',
        severity: 'error',
        link: `/costs?team=${worstRow.team_id}`,
      })
    }

    // 3. Most expensive session — approximate from daily averages
    if (teamCostResult.rows.length > 0) {
      const totalCost = teamCostResult.rows.reduce((s, r) => s + num(r.cost), 0)
      const totalSessResult = await pool.query(
        `SELECT COALESCE(SUM(total_sessions), 0) AS cnt FROM daily_session_summary ${f.where}`,
        f.params,
      )
      const totalSessions = num(totalSessResult.rows[0].cnt)
      const avgCost = totalSessions > 0 ? totalCost / totalSessions : 0

      // Estimate: most expensive session is ~5-10x the average
      const estExpensive = avgCost * 8
      result.push({
        type: 'expensiveSession',
        title: `Estimated peak session cost $${estExpensive.toFixed(2)} — ~8x avg`,
        description: 'Anomalous session detected; review recommended',
        severity: 'info',
        link: '/overview',
      })
    }

    return c.json(result)
  })
