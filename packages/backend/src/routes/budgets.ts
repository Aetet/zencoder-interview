import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamSSE } from 'hono/streaming'
import { saveBudgetSchema } from '@zendash/shared/schemas'
import { pool, num, r2 } from '../db.js'
import { computeUpdatedBudget, BudgetValidationError } from '../budget-logic.js'

type Listener = (data: string) => void
const listeners = new Set<Listener>()

function broadcast(data: string) {
  for (const fn of listeners) fn(data)
}

async function fetchBudgetState() {
  const configResult = await pool.query(
    'SELECT monthly_budget, thresholds, team_overrides FROM budget_config WHERE id = 1',
  )
  const config = configResult.rows[0]
  const monthlyBudget = config ? num(config.monthly_budget) : 6000
  const overrides: Record<string, number> = config?.team_overrides ?? {}

  const teamCount = num((await pool.query('SELECT COUNT(*) AS cnt FROM teams')).rows[0].cnt)
  const overrideSum = Object.values(overrides).reduce((s, v) => s + v, 0)
  const nonOverriddenCount = teamCount - Object.keys(overrides).length
  const remaining = monthlyBudget - overrideSum
  const autoBudget = nonOverriddenCount > 0 && remaining > 0 ? remaining / nonOverriddenCount : 0

  const spendResult = await pool.query(
    `SELECT dss.team_id, t.name AS team_name, SUM(dss.total_cost) AS spent
     FROM daily_session_summary dss JOIN teams t ON t.id = dss.team_id
     WHERE dss.date >= date_trunc('month', NOW())
     GROUP BY dss.team_id, t.name`,
  )

  const teamBudgets = spendResult.rows.map((r) => {
    const teamId = r.team_id as string
    return {
      teamId,
      teamName: r.team_name as string,
      budget: r2(teamId in overrides ? overrides[teamId] : autoBudget),
      spent: r2(num(r.spent)),
    }
  })

  return {
    monthlyBudget,
    teamOverrides: overrides,
    autoBudget: r2(autoBudget),
    teamBudgets,
  }
}

export const budgets = new Hono()
  .get('/', async (c) => {
    const result = await pool.query(
      'SELECT monthly_budget, team_overrides FROM budget_config WHERE id = 1',
    )
    const row = result.rows[0]
    if (!row) {
      return c.json({ monthlyBudget: 6000, teamOverrides: {} })
    }
    return c.json({
      monthlyBudget: num(row.monthly_budget),
      teamOverrides: row.team_overrides ?? {},
    })
  })

  .post('/', zValidator('json', saveBudgetSchema), async (c) => {
    const body = c.req.valid('json')

    const currentResult = await pool.query(
      'SELECT monthly_budget, team_overrides FROM budget_config WHERE id = 1',
    )
    const row = currentResult.rows[0]
    const current = {
      monthlyBudget: row ? num(row.monthly_budget) : 6000,
      teamOverrides: (row?.team_overrides ?? {}) as Record<string, number>,
    }

    const teamCountResult = await pool.query('SELECT COUNT(*) AS cnt FROM teams')
    const teamCount = num(teamCountResult.rows[0].cnt)

    let updated
    try {
      updated = computeUpdatedBudget(current, {
        monthlyBudget: body.monthlyBudget,
        teamOverrides: body.teamOverrides ?? current.teamOverrides,
      }, teamCount)
    } catch (e) {
      if (e instanceof BudgetValidationError) {
        return c.json({ success: false, error: e.message }, 400)
      }
      throw e
    }

    await pool.query(
      `UPDATE budget_config SET monthly_budget = $1, team_overrides = $2 WHERE id = 1`,
      [updated.monthlyBudget, JSON.stringify(updated.teamOverrides)],
    )

    // Broadcast updated state to all SSE listeners
    const state = await fetchBudgetState()
    broadcast(JSON.stringify(state))

    return c.json({ success: true })
  })

  .post('/team', async (c) => {
    const body = await c.req.json<{ teamId: string; budget: number | null }>()
    if (!body.teamId) return c.json({ success: false, error: 'teamId required' }, 400)

    const currentResult = await pool.query(
      'SELECT monthly_budget, team_overrides FROM budget_config WHERE id = 1',
    )
    const row = currentResult.rows[0]
    const currentBudget = row ? num(row.monthly_budget) : 6000
    const overrides: Record<string, number> = { ...((row?.team_overrides ?? {}) as Record<string, number>) }

    if (body.budget == null || body.budget <= 0) {
      delete overrides[body.teamId]
    } else {
      overrides[body.teamId] = body.budget
    }

    const teamCountResult = await pool.query('SELECT COUNT(*) AS cnt FROM teams')
    const teamCount = num(teamCountResult.rows[0].cnt)

    let updated
    try {
      updated = computeUpdatedBudget(
        { monthlyBudget: currentBudget, teamOverrides: (row?.team_overrides ?? {}) as Record<string, number> },
        { monthlyBudget: currentBudget, teamOverrides: overrides },
        teamCount,
      )
    } catch (e) {
      if (e instanceof BudgetValidationError) {
        return c.json({ success: false, error: e.message }, 400)
      }
      throw e
    }

    await pool.query(
      `UPDATE budget_config SET monthly_budget = $1, team_overrides = $2 WHERE id = 1`,
      [updated.monthlyBudget, JSON.stringify(updated.teamOverrides)],
    )

    const state = await fetchBudgetState()
    broadcast(JSON.stringify(state))

    return c.json({ success: true })
  })

  .get('/live', (c) => {
    return streamSSE(c, async (stream) => {
      let id = 0

      // Send current state immediately
      const initial = await fetchBudgetState()
      await stream.writeSSE({ data: JSON.stringify(initial), event: 'update', id: String(id++) })

      // Listen for broadcasts from POST
      const listener: Listener = (data) => {
        stream.writeSSE({ data, event: 'update', id: String(id++) }).catch(() => {})
      }
      listeners.add(listener)

      // Keep alive until client disconnects
      try {
        while (true) {
          await stream.sleep(30_000)
        }
      } finally {
        listeners.delete(listener)
      }
    })
  })
