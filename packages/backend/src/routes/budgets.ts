import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { saveBudgetSchema } from '@zendash/shared/schemas'
import { pool, num } from '../db.js'

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

    await pool.query(
      `UPDATE budget_config
       SET monthly_budget = $1, team_overrides = COALESCE($2, team_overrides)
       WHERE id = 1`,
      [body.monthlyBudget, body.teamOverrides ? JSON.stringify(body.teamOverrides) : null],
    )

    return c.json({ success: true })
  })
