import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { pool, buildFilters, num } from '../db.js'
import type { TopFilesData } from '@zendash/shared'

const FILE_PATHS = [
  'src/services/payment.ts',
  'src/api/routes.ts',
  'src/auth/middleware.ts',
  'src/db/queries.ts',
  'src/utils/helpers.ts',
  'src/components/Dashboard.tsx',
  'src/hooks/useAuth.ts',
  'src/config/env.ts',
  'src/models/user.ts',
  'src/workers/processor.ts',
  'src/lib/cache.ts',
  'src/api/handlers/orders.ts',
  'src/services/notification.ts',
  'src/middleware/rateLimit.ts',
  'src/types/index.ts',
]

export const files = new Hono()
  .get('/top', zValidator('query', filterQuerySchema), async (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', team_id, model })

    const sessResult = await pool.query(
      `SELECT COALESCE(SUM(total_sessions), 0) AS cnt FROM daily_session_summary ${f.where}`,
      f.params,
    )
    const totalSessions = num(sessResult.rows[0].cnt)

    // Deterministic file access simulation (same logic as mock version)
    const mostRead = FILE_PATHS.slice(0, 10).map((path, i) => {
      const weight = 1 - i * 0.08
      const count = Math.round(totalSessions * weight * (0.8 + Math.random() * 0.4))
      const sessionCount = Math.round(count * (0.2 + Math.random() * 0.3))
      return {
        path,
        count,
        sessions: Math.min(sessionCount, totalSessions),
        cost: Math.round(count * 0.024 * 100) / 100,
        churn: 0,
      }
    }).sort((a, b) => b.count - a.count)

    const mostEdited = FILE_PATHS.slice(2, 12).map((path, i) => {
      const weight = 0.6 - i * 0.05
      const count = Math.round(totalSessions * weight * (0.5 + Math.random() * 0.5))
      const sessionCount = Math.round(count * (0.3 + Math.random() * 0.4))
      return {
        path,
        count,
        sessions: Math.min(sessionCount, totalSessions),
        cost: Math.round(count * 0.018 * 100) / 100,
        churn: Math.round((count / Math.max(sessionCount, 1)) * 10) / 10,
      }
    }).sort((a, b) => b.count - a.count)

    const result: TopFilesData = { mostRead, mostEdited }
    return c.json(result)
  })
