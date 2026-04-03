import { Hono } from 'hono'
import { store } from '../mock/store.js'
import type { AlertConfig } from '@zendash/shared'

export const alerts = new Hono()

alerts.get('/', (c) => {
  return c.json(store.budget)
})

alerts.post('/', async (c) => {
  const body = await c.req.json<AlertConfig>()

  if (typeof body.monthlyBudget !== 'number' || body.monthlyBudget <= 0) {
    return c.json({ error: 'monthlyBudget must be a positive number' }, 400)
  }

  if (!Array.isArray(body.thresholds) || body.thresholds.length === 0) {
    return c.json({ error: 'thresholds must be a non-empty array' }, 400)
  }

  for (const t of body.thresholds) {
    if (typeof t !== 'number' || t < 0 || t > 100) {
      return c.json({ error: 'Each threshold must be a number between 0 and 100' }, 400)
    }
  }

  store.budget.monthlyBudget = body.monthlyBudget
  store.budget.thresholds = body.thresholds

  return c.json({ success: true })
})
