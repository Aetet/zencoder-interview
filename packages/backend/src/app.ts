import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sessions } from './routes/sessions.js'
import { costs } from './routes/costs.js'
import { teams } from './routes/teams.js'
import { files } from './routes/files.js'
import { insights } from './routes/insights.js'
import { quality } from './routes/quality.js'
import { alerts } from './routes/alerts.js'
import { budgets } from './routes/budgets.js'
import { live } from './routes/live.js'
import { turbo } from './routes/turbo.js'

const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:5173' }))

const api = app
  .route('/api/sessions', sessions)
  .route('/api/costs', costs)
  .route('/api/teams', teams)
  .route('/api/files', files)
  .route('/api/insights', insights)
  .route('/api/quality', quality)
  .route('/api/alerts', alerts)
  .route('/api/budgets', budgets)
  .route('/api/overview', live)
  .route('/api/turbo', turbo)

export type AppType = typeof api
export default app
