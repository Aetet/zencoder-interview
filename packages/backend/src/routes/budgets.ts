import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { saveBudgetSchema } from '@zendash/shared/schemas'
import { store } from '../mock/store.js'

export const budgets = new Hono()
  .get('/', (c) => {
    return c.json({
      monthlyBudget: store.budget.monthlyBudget,
      teamOverrides: store.budget.teamOverrides,
    })
  })
  .post('/', zValidator('json', saveBudgetSchema), (c) => {
    const body = c.req.valid('json')

    store.budget.monthlyBudget = body.monthlyBudget
    if (body.teamOverrides) {
      store.budget.teamOverrides = body.teamOverrides
    }

    return c.json({ success: true })
  })
