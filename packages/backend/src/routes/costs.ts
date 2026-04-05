import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { pool, buildFilters, r2, num } from '../db.js'
import type { CostBreakdown, CacheData, BudgetData } from '@zendash/shared'

const MODEL_PRICING: Record<string, { input: number; output: number; cacheCreate: number; cacheRead: number }> = {
  haiku:  { input: 0.25,  output: 1.25,  cacheCreate: 0.30,  cacheRead: 0.03 },
  sonnet: { input: 3.00,  output: 15.00, cacheCreate: 3.75,  cacheRead: 0.30 },
  opus:   { input: 15.00, output: 75.00, cacheCreate: 18.75, cacheRead: 1.50 },
}

export const costs = new Hono()
  .get('/breakdown', zValidator('query', filterQuerySchema), async (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', team_id, model })

    // Total cost
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS total FROM daily_token_stats ${f.where}`,
      f.params,
    )
    const total = num(totalResult.rows[0].total)

    // By team
    const byTeamResult = await pool.query(
      `SELECT dts.team_id, t.name AS team_name, SUM(dts.total_cost) AS cost
       FROM daily_token_stats dts JOIN teams t ON t.id = dts.team_id
       ${f.where} GROUP BY dts.team_id, t.name ORDER BY cost DESC`,
      f.params,
    )
    const byTeam = byTeamResult.rows.map((r) => ({
      teamId: r.team_id as string,
      teamName: r.team_name as string,
      cost: r2(num(r.cost)),
    }))

    // By model
    const byModelResult = await pool.query(
      `SELECT model, SUM(total_cost) AS cost
       FROM daily_token_stats ${f.where} GROUP BY model`,
      f.params,
    )
    const byModel = byModelResult.rows.map((r) => ({
      model: r.model as string,
      cost: r2(num(r.cost)),
    }))

    // Token totals per model for by-token-type breakdown
    const tokenResult = await pool.query(
      `SELECT model, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
              SUM(cache_creation) AS cache_c, SUM(cache_read) AS cache_r
       FROM daily_token_stats ${f.where} GROUP BY model`,
      f.params,
    )
    let inputCost = 0, outputCost = 0, cacheCreateCost = 0, cacheReadCost = 0
    for (const r of tokenResult.rows) {
      const p = MODEL_PRICING[r.model as string] ?? MODEL_PRICING.sonnet
      inputCost += num(r.input) * p.input / 1_000_000
      outputCost += num(r.output) * p.output / 1_000_000
      cacheCreateCost += num(r.cache_c) * p.cacheCreate / 1_000_000
      cacheReadCost += num(r.cache_r) * p.cacheRead / 1_000_000
    }

    // Daily token trend (cost per token type per day)
    const dailyResult = await pool.query(
      `SELECT date, model, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
              SUM(cache_creation) AS cache_c, SUM(cache_read) AS cache_r
       FROM daily_token_stats ${f.where} GROUP BY date, model ORDER BY date`,
      f.params,
    )
    const dayMap = new Map<string, { input: number; output: number; cacheCreation: number; cacheRead: number }>()
    for (const r of dailyResult.rows) {
      const date = (r.date as Date).toISOString().slice(0, 10)
      const p = MODEL_PRICING[r.model as string] ?? MODEL_PRICING.sonnet
      const e = dayMap.get(date) ?? { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
      e.input += num(r.input) * p.input / 1_000_000
      e.output += num(r.output) * p.output / 1_000_000
      e.cacheCreation += num(r.cache_c) * p.cacheCreate / 1_000_000
      e.cacheRead += num(r.cache_r) * p.cacheRead / 1_000_000
      dayMap.set(date, e)
    }
    const tokenTrend = Array.from(dayMap.entries())
      .map(([date, t]) => ({ date, input: r2(t.input), output: r2(t.output), cacheCreation: r2(t.cacheCreation), cacheRead: r2(t.cacheRead) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Completed session count for costPerSession
    const sessResult = await pool.query(
      `SELECT COALESCE(SUM(completed), 0) AS cnt FROM daily_session_summary ${f.where}`,
      f.params,
    )
    const completedCount = num(sessResult.rows[0].cnt)

    const result: CostBreakdown = {
      total: r2(total),
      byTeam,
      byModel,
      byTokenType: { input: r2(inputCost), output: r2(outputCost), cacheCreation: r2(cacheCreateCost), cacheRead: r2(cacheReadCost) },
      tokenTrend,
      costPerSession: completedCount > 0 ? r2(total / completedCount) : 0,
    }
    return c.json(result)
  })

  .get('/cache', zValidator('query', filterQuerySchema), async (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', team_id, model })

    // Org-wide
    const orgResult = await pool.query(
      `SELECT COALESCE(SUM(cache_read), 0) AS cr, COALESCE(SUM(input_tokens), 0) AS inp
       FROM daily_token_stats ${f.where}`,
      f.params,
    )
    const totalCR = num(orgResult.rows[0].cr)
    const totalInp = num(orgResult.rows[0].inp)
    const orgRate = (totalCR + totalInp) > 0 ? totalCR / (totalCR + totalInp) : 0

    // Savings per model
    const savingsResult = await pool.query(
      `SELECT model, SUM(cache_read) AS cr
       FROM daily_token_stats ${f.where} GROUP BY model`,
      f.params,
    )
    let savings = 0
    for (const r of savingsResult.rows) {
      const p = MODEL_PRICING[r.model as string] ?? MODEL_PRICING.sonnet
      savings += num(r.cr) * (p.input - p.cacheRead) / 1_000_000
    }

    // By team
    const teamResult = await pool.query(
      `SELECT dts.team_id, t.name AS team_name,
              SUM(dts.cache_read) AS cr, SUM(dts.input_tokens) AS inp
       FROM daily_token_stats dts JOIN teams t ON t.id = dts.team_id
       ${f.where} GROUP BY dts.team_id, t.name`,
      f.params,
    )
    const byTeam = teamResult.rows.map((r) => {
      const cr = num(r.cr), inp = num(r.inp)
      return { teamId: r.team_id as string, teamName: r.team_name as string, rate: (cr + inp) > 0 ? cr / (cr + inp) : 0 }
    })

    // Daily trend
    const trendResult = await pool.query(
      `SELECT date, SUM(cache_read) AS cr, SUM(input_tokens) AS inp
       FROM daily_token_stats ${f.where} GROUP BY date ORDER BY date`,
      f.params,
    )
    const trend = trendResult.rows.map((r) => {
      const cr = num(r.cr), inp = num(r.inp)
      return { date: (r.date as Date).toISOString().slice(0, 10), rate: (cr + inp) > 0 ? cr / (cr + inp) : 0 }
    })

    const result: CacheData = { orgCacheHitRate: orgRate, savings: r2(savings), byTeam, trend }
    return c.json(result)
  })

  .get('/budget', async (c) => {
    // Current month spend
    const spendResult = await pool.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS spend
       FROM daily_session_summary
       WHERE date >= date_trunc('month', NOW())`,
    )
    const currentSpend = num(spendResult.rows[0].spend)

    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const projected = dayOfMonth > 0 ? (currentSpend / dayOfMonth) * daysInMonth : currentSpend

    // Budget config
    const configResult = await pool.query(
      'SELECT monthly_budget, thresholds, team_overrides FROM budget_config WHERE id = 1',
    )
    const config = configResult.rows[0]
    const monthlyBudget = config ? num(config.monthly_budget) : 6000
    const thresholds: number[] = config?.thresholds ?? [50, 75, 90, 100]

    // Per-team spend this month
    const teamSpendResult = await pool.query(
      `SELECT dss.team_id, t.name AS team_name, SUM(dss.total_cost) AS spent
       FROM daily_session_summary dss JOIN teams t ON t.id = dss.team_id
       WHERE dss.date >= date_trunc('month', NOW())
       GROUP BY dss.team_id, t.name`,
    )

    const overrides: Record<string, number> = config?.team_overrides ?? {}
    const teamCount = num((await pool.query('SELECT COUNT(*) AS cnt FROM teams')).rows[0].cnt)
    const overrideSum = Object.values(overrides).reduce((s, v) => s + v, 0)
    const nonOverriddenCount = teamCount - Object.keys(overrides).length
    const autoBudget = nonOverriddenCount > 0 ? Math.max(1, (monthlyBudget - overrideSum) / nonOverriddenCount) : 0

    const teamBudgets = teamSpendResult.rows.map((r) => {
      const teamId = r.team_id as string
      return {
        teamId,
        teamName: r.team_name as string,
        budget: r2(teamId in overrides ? overrides[teamId] : autoBudget),
        spent: r2(num(r.spent)),
      }
    })

    const result: BudgetData = {
      monthlyBudget,
      currentSpend: r2(currentSpend),
      projected: r2(projected),
      percentUsed: monthlyBudget > 0 ? currentSpend / monthlyBudget : 0,
      thresholds,
      teamBudgets,
    }
    return c.json(result)
  })
