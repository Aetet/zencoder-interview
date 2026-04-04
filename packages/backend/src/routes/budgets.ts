import { Hono } from 'hono'
import { store } from '../mock/store.js'

export const budgets = new Hono()

// GET /api/budgets — current budget config
budgets.get('/', (c) => {
  return c.json({
    monthlyBudget: store.budget.monthlyBudget,
    teamOverrides: store.budget.teamOverrides,
  })
})

// POST /api/budgets — save budget config
budgets.post('/', async (c) => {
  const body = await c.req.json<{
    monthlyBudget: number
    teamOverrides?: Record<string, number>
  }>()

  if (typeof body.monthlyBudget !== 'number' || body.monthlyBudget <= 0) {
    return c.json({ error: 'monthlyBudget must be a positive number' }, 400)
  }

  store.budget.monthlyBudget = body.monthlyBudget
  if (body.teamOverrides) {
    store.budget.teamOverrides = body.teamOverrides
  }

  return c.json({ success: true })
})
