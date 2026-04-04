import { Hono } from 'hono'
import { store, filterSessions, getTeamBudgets } from '../mock/store.js'
import { generateAlerts } from '../mock/alerts.js'

export const alerts = new Hono()

// GET /api/alerts — alert history, generated from session data + budget config
alerts.get('/', (c) => {
  const events = generateAlerts({
    sessions: filterSessions({}),
    teams: store.teams,
    budget: store.budget.monthlyBudget,
    thresholds: store.budget.thresholds,
    teamBudgets: getTeamBudgets(),
  })
  return c.json(events)
})
