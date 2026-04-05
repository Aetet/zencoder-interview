import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { filterSessions } from '../mock/store.js'
import type { QualityTier1 } from '@zendash/shared'

export const quality = new Hono()
  .get('/tier1', zValidator('query', filterQuerySchema), (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const params = { range: range ?? '30d', team_id, model }

    const filtered = filterSessions(params)
    const completed = filtered.filter((s) => s.status === 'completed')
    const errored = filtered.filter((s) => s.status === 'error')

    const errorsByCategory: Record<string, number> = { api: 0, tool: 0, permission: 0, runtime: 0 }
    for (const s of errored) {
      if (s.errorCategory) {
        errorsByCategory[s.errorCategory] = (errorsByCategory[s.errorCategory] ?? 0) + 1
      }
    }

    const totalToolCalls = filtered.reduce((s, x) => s + x.toolCalls, 0)
    const totalToolErrors = filtered.reduce((s, x) => s + x.toolErrors, 0)

    const retryableSessions = errored.filter((s) => s.errorCategory === 'api' || s.errorCategory === 'runtime')
    const recoveredSessions = retryableSessions.length > 0
      ? Math.round(retryableSessions.length * 0.6)
      : 0

    const result: QualityTier1 = {
      sessionSuccessRate: filtered.length > 0 ? completed.length / filtered.length : 0,
      errorsByCategory,
      toolErrorRate: totalToolCalls > 0 ? totalToolErrors / totalToolCalls : 0,
      retryableRecoveryRate: retryableSessions.length > 0 ? recoveredSessions / retryableSessions.length : 0,
    }

    return c.json(result)
  })
