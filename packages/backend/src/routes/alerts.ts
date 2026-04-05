import { Hono } from 'hono'
import { pool, num } from '../db.js'
import type { AlertEvent } from '@zendash/shared'

export const alerts = new Hono()
  .get('/', async (c) => {
    const result = await pool.query(
      `SELECT id, type, severity, title, description, team_id, ts
       FROM alerts_log
       ORDER BY ts DESC
       LIMIT 25`,
    )

    const events: AlertEvent[] = result.rows.map((r) => ({
      id: r.id as string,
      type: r.type as AlertEvent['type'],
      severity: r.severity as AlertEvent['severity'],
      title: r.title as string,
      description: r.description as string,
      teamId: (r.team_id as string | null),
      timestamp: (r.ts as Date).toISOString(),
    }))

    return c.json(events)
  })
