import { describe, it, expect } from 'vitest'
import app from '../app.js'

async function get(path: string) {
  const res = await app.request(path)
  return { status: res.status, body: await res.json() }
}

describe('GET /api/sessions/summary', () => {
  it('returns 200 with session summary', async () => {
    const { status, body } = await get('/api/sessions/summary?range=30d')
    expect(status).toBe(200)
    expect(body).toHaveProperty('totalSessions')
    expect(body).toHaveProperty('completionRate')
    expect(body).toHaveProperty('totalCost')
    expect(body).toHaveProperty('trend')
    expect(body).toHaveProperty('costTrend')
    expect(body.totalSessions).toBeGreaterThan(0)
  })

  it('filters by team_id', async () => {
    const all = await get('/api/sessions/summary?range=30d')
    const backend = await get('/api/sessions/summary?range=30d&team_id=backend')
    expect(backend.body.totalSessions).toBeLessThanOrEqual(all.body.totalSessions)
    expect(backend.body.totalSessions).toBeGreaterThan(0)
  })

  it('filters by model', async () => {
    const { body } = await get('/api/sessions/summary?range=30d&model=haiku')
    expect(body.totalSessions).toBeGreaterThan(0)
  })

  it('returns fewer sessions for shorter range', async () => {
    const d30 = await get('/api/sessions/summary?range=30d')
    const d7 = await get('/api/sessions/summary?range=7d')
    expect(d7.body.totalSessions).toBeLessThanOrEqual(d30.body.totalSessions)
  })

  it('completion rate is between 0 and 1', async () => {
    const { body } = await get('/api/sessions/summary?range=30d')
    expect(body.completionRate).toBeGreaterThanOrEqual(0)
    expect(body.completionRate).toBeLessThanOrEqual(1)
  })

  it('trend is array of daily data', async () => {
    const { body } = await get('/api/sessions/summary?range=30d')
    expect(Array.isArray(body.trend)).toBe(true)
    expect(body.trend.length).toBeGreaterThan(0)
    expect(body.trend[0]).toHaveProperty('date')
    expect(body.trend[0]).toHaveProperty('completed')
    expect(body.trend[0]).toHaveProperty('errored')
  })
})

describe('GET /api/costs/breakdown', () => {
  it('returns 200 with cost breakdown', async () => {
    const { status, body } = await get('/api/costs/breakdown?range=30d')
    expect(status).toBe(200)
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('byTeam')
    expect(body).toHaveProperty('byModel')
    expect(body).toHaveProperty('byTokenType')
    expect(body).toHaveProperty('tokenTrend')
  })

  it('byTokenType has 4 token types', async () => {
    const { body } = await get('/api/costs/breakdown?range=30d')
    expect(body.byTokenType).toHaveProperty('input')
    expect(body.byTokenType).toHaveProperty('output')
    expect(body.byTokenType).toHaveProperty('cacheCreation')
    expect(body.byTokenType).toHaveProperty('cacheRead')
  })

  it('byTeam costs sum to total', async () => {
    const { body } = await get('/api/costs/breakdown?range=30d')
    const teamSum = body.byTeam.reduce((s: number, t: { cost: number }) => s + t.cost, 0)
    expect(Math.abs(teamSum - body.total)).toBeLessThan(1)
  })

  it('all costs are non-negative', async () => {
    const { body } = await get('/api/costs/breakdown?range=30d')
    expect(body.total).toBeGreaterThanOrEqual(0)
    expect(body.byTokenType.input).toBeGreaterThanOrEqual(0)
    expect(body.byTokenType.output).toBeGreaterThanOrEqual(0)
    expect(body.byTokenType.cacheCreation).toBeGreaterThanOrEqual(0)
    expect(body.byTokenType.cacheRead).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /api/costs/cache', () => {
  it('returns 200 with cache data', async () => {
    const { status, body } = await get('/api/costs/cache?range=30d')
    expect(status).toBe(200)
    expect(body).toHaveProperty('orgCacheHitRate')
    expect(body).toHaveProperty('savings')
    expect(body).toHaveProperty('byTeam')
    expect(body).toHaveProperty('trend')
  })

  it('cache hit rate between 0 and 1', async () => {
    const { body } = await get('/api/costs/cache?range=30d')
    expect(body.orgCacheHitRate).toBeGreaterThanOrEqual(0)
    expect(body.orgCacheHitRate).toBeLessThanOrEqual(1)
  })

  it('savings is non-negative', async () => {
    const { body } = await get('/api/costs/cache?range=30d')
    expect(body.savings).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /api/costs/budget', () => {
  it('returns 200 with budget data', async () => {
    const { status, body } = await get('/api/costs/budget')
    expect(status).toBe(200)
    expect(body).toHaveProperty('monthlyBudget')
    expect(body).toHaveProperty('currentSpend')
    expect(body).toHaveProperty('projected')
    expect(body).toHaveProperty('percentUsed')
    expect(body).toHaveProperty('teamBudgets')
    expect(body.monthlyBudget).toBe(6000)
  })
})

describe('GET /api/teams', () => {
  it('returns 200 with 6 teams', async () => {
    const { status, body } = await get('/api/teams?range=30d')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(1000)
  })

  it('each team has required fields', async () => {
    const { body } = await get('/api/teams?range=30d')
    const team = body[0]
    expect(team).toHaveProperty('id')
    expect(team).toHaveProperty('name')
    expect(team).toHaveProperty('sessions')
    expect(team).toHaveProperty('cost')
    expect(team).toHaveProperty('completionRate')
    expect(team).toHaveProperty('costPerSession')
    expect(team).toHaveProperty('cacheHitRate')
  })
})

describe('GET /api/teams/:id/users', () => {
  it('returns users for a known team', async () => {
    const { status, body } = await get('/api/teams/backend/users?range=30d')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('email')
    expect(body[0]).toHaveProperty('sessions')
  })

  it('returns 404 for unknown team', async () => {
    const res = await app.request('/api/teams/nonexistent/users?range=30d')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/files/top', () => {
  it('returns most read and most edited files', async () => {
    const { status, body } = await get('/api/files/top?range=30d')
    expect(status).toBe(200)
    expect(body).toHaveProperty('mostRead')
    expect(body).toHaveProperty('mostEdited')
    expect(body.mostRead.length).toBeLessThanOrEqual(10)
    expect(body.mostEdited.length).toBeLessThanOrEqual(10)
  })

  it('files are sorted by count descending', async () => {
    const { body } = await get('/api/files/top?range=30d')
    for (let i = 1; i < body.mostRead.length; i++) {
      expect(body.mostRead[i - 1].count).toBeGreaterThanOrEqual(body.mostRead[i].count)
    }
  })
})

describe('GET /api/insights', () => {
  it('returns up to 3 insights', async () => {
    const { status, body } = await get('/api/insights?range=30d')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)
    expect(body.length).toBeLessThanOrEqual(3)
  })

  it('each insight has required fields', async () => {
    const { body } = await get('/api/insights?range=30d')
    expect(body[0]).toHaveProperty('type')
    expect(body[0]).toHaveProperty('title')
    expect(body[0]).toHaveProperty('description')
    expect(body[0]).toHaveProperty('severity')
    expect(body[0]).toHaveProperty('link')
  })
})

describe('GET /api/quality/tier1', () => {
  it('returns quality metrics', async () => {
    const { status, body } = await get('/api/quality/tier1?range=30d')
    expect(status).toBe(200)
    expect(body).toHaveProperty('sessionSuccessRate')
    expect(body).toHaveProperty('errorsByCategory')
    expect(body).toHaveProperty('toolErrorRate')
    expect(body.sessionSuccessRate).toBeGreaterThanOrEqual(0)
    expect(body.sessionSuccessRate).toBeLessThanOrEqual(1)
  })

  it('error categories include known types', async () => {
    const { body } = await get('/api/quality/tier1?range=30d')
    expect(body.errorsByCategory).toHaveProperty('api')
    expect(body.errorsByCategory).toHaveProperty('tool')
    expect(body.errorsByCategory).toHaveProperty('permission')
    expect(body.errorsByCategory).toHaveProperty('runtime')
  })
})

describe('POST /api/budgets', () => {
  it('saves valid budget config', async () => {
    const res = await app.request('/api/budgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: 5000 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('rejects negative budget', async () => {
    const res = await app.request('/api/budgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: -100 }),
    })
    expect(res.status).toBe(400)
  })

  it('persists budget change', async () => {
    await app.request('/api/budgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: 8000 }),
    })
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.monthlyBudget).toBe(8000)

    // Restore default
    await app.request('/api/budgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: 6000 }),
    })
  })

  it('persists team budget overrides', async () => {
    const overrides = { backend: 500, frontend: 300 }
    await app.request('/api/budgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: 6000, teamOverrides: overrides }),
    })
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.teamOverrides).toEqual(overrides)

    // Restore default
    await app.request('/api/budgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: 6000, teamOverrides: {} }),
    })
  })
})

describe('GET /api/alerts', () => {
  it('returns array of alert events', async () => {
    const res = await app.request('/api/alerts')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('each alert has required fields', async () => {
    const res = await app.request('/api/alerts')
    const body = await res.json()
    if (body.length > 0) {
      const alert = body[0]
      expect(alert.id).toBeDefined()
      expect(alert.type).toBeDefined()
      expect(alert.severity).toBeDefined()
      expect(alert.title).toBeDefined()
      expect(alert.description).toBeDefined()
      expect(alert.timestamp).toBeDefined()
      expect(['error', 'warning', 'info']).toContain(alert.severity)
      expect(['budget_exceeded', 'threshold_reached', 'spend_spike', 'anomaly']).toContain(alert.type)
    }
  })

  it('returns max 25 alerts', async () => {
    const res = await app.request('/api/alerts')
    const body = await res.json()
    expect(body.length).toBeLessThanOrEqual(25)
  })
})

describe('GET /api/overview/live', () => {
  it('returns SSE content type', async () => {
    const res = await app.request('/api/overview/live')
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })
})
