import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { pool, buildFilters, num } from '../db.js'
import type { QualityTier1 } from '@zendash/shared'

const RETRYABLE_RECOVERY_RATE = 0.60

export const quality = new Hono()
  .get('/tier1', zValidator('query', filterQuerySchema), async (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const f = buildFilters({ range: range ?? '30d', team_id, model })

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(total_sessions), 0) AS total,
        COALESCE(SUM(completed), 0) AS completed,
        COALESCE(SUM(tool_calls), 0) AS tool_calls,
        COALESCE(SUM(tool_errors), 0) AS tool_errors,
        COALESCE(SUM(errors_api), 0) AS errors_api,
        COALESCE(SUM(errors_tool), 0) AS errors_tool,
        COALESCE(SUM(errors_permission), 0) AS errors_permission,
        COALESCE(SUM(errors_runtime), 0) AS errors_runtime
      FROM daily_quality_stats ${f.where}`,
      f.params,
    )

    const r = result.rows[0]
    const total = num(r.total)
    const completed = num(r.completed)
    const toolCalls = num(r.tool_calls)
    const toolErrors = num(r.tool_errors)

    const data: QualityTier1 = {
      sessionSuccessRate: total > 0 ? completed / total : 0,
      errorsByCategory: {
        api: num(r.errors_api),
        tool: num(r.errors_tool),
        permission: num(r.errors_permission),
        runtime: num(r.errors_runtime),
      },
      toolErrorRate: toolCalls > 0 ? toolErrors / toolCalls : 0,
      retryableRecoveryRate: RETRYABLE_RECOVERY_RATE,
    }

    return c.json(data)
  })
