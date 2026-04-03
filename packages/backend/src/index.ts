import { serve } from '@hono/node-server'
import app from './app.js'

export type { AppType } from './app.js'
export default app

const port = 3001
console.log(`ZenDash backend running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
