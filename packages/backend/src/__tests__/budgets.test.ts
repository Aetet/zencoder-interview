import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { store, getTeamBudgets } from '../mock/store.js'

function postBudget(body: Record<string, unknown>) {
  return app.request('/api/budgets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  // Reset to defaults before each test
  store.budget.monthlyBudget = 6000
  store.budget.teamOverrides = {}
})

describe('GET /api/budgets', () => {
  it('returns current budget config', async () => {
    const res = await app.request('/api/budgets')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.monthlyBudget).toBe(6000)
    expect(body.teamOverrides).toEqual({})
  })

  it('reflects stored overrides', async () => {
    store.budget.teamOverrides = { backend: 500 }
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.teamOverrides).toEqual({ backend: 500 })
  })
})

describe('POST /api/budgets — validation', () => {
  it('rejects negative budget', async () => {
    const res = await postBudget({ monthlyBudget: -100 })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('positive number')
  })

  it('rejects zero budget', async () => {
    const res = await postBudget({ monthlyBudget: 0 })
    expect(res.status).toBe(400)
  })

  it('rejects missing monthlyBudget', async () => {
    const res = await postBudget({})
    expect(res.status).toBe(400)
  })

  it('rejects string budget', async () => {
    const res = await postBudget({ monthlyBudget: 'abc' })
    expect(res.status).toBe(400)
  })

  it('accepts valid budget', async () => {
    const res = await postBudget({ monthlyBudget: 5000 })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

describe('POST /api/budgets — persistence', () => {
  it('persists monthly budget', async () => {
    await postBudget({ monthlyBudget: 8000 })
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.monthlyBudget).toBe(8000)
  })

  it('persists team overrides', async () => {
    const overrides = { backend: 500, frontend: 300 }
    await postBudget({ monthlyBudget: 6000, teamOverrides: overrides })
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.teamOverrides).toEqual(overrides)
  })

  it('replaces previous overrides', async () => {
    await postBudget({ monthlyBudget: 6000, teamOverrides: { backend: 500 } })
    await postBudget({ monthlyBudget: 6000, teamOverrides: { frontend: 200 } })
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.teamOverrides).toEqual({ frontend: 200 })
  })

  it('keeps overrides when not provided', async () => {
    await postBudget({ monthlyBudget: 6000, teamOverrides: { backend: 500 } })
    await postBudget({ monthlyBudget: 7000 })
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.monthlyBudget).toBe(7000)
    expect(body.teamOverrides).toEqual({ backend: 500 })
  })

  it('clears overrides with empty object', async () => {
    await postBudget({ monthlyBudget: 6000, teamOverrides: { backend: 500 } })
    await postBudget({ monthlyBudget: 6000, teamOverrides: {} })
    const res = await app.request('/api/budgets')
    const body = await res.json()
    expect(body.teamOverrides).toEqual({})
  })
})

describe('POST /api/budgets — affects alerts', () => {
  it('changing budget affects alert generation', async () => {
    // Set a low budget so threshold alerts fire
    await postBudget({ monthlyBudget: 1 })
    const res = await app.request('/api/alerts')
    const alerts = await res.json()
    const thresholds = alerts.filter((a: { type: string }) => a.type === 'threshold_reached')
    expect(thresholds.length).toBeGreaterThan(0)
  })

  it('team override affects per-team alert', async () => {
    // Set a very low override for one team — backend should exceed $0.001
    store.budget.monthlyBudget = 100000
    store.budget.teamOverrides = { backend: 0.001 }
    const budgets = getTeamBudgets()
    expect(budgets['backend']).toBe(0.001)

    const res = await app.request('/api/alerts')
    const alerts = await res.json()
    const backendExceeded = alerts.find(
      (a: { type: string; teamId: string }) => a.type === 'budget_exceeded' && a.teamId === 'backend'
    )
    expect(backendExceeded).toBeDefined()
  })

  it('high budget means no exceeded alerts', async () => {
    await postBudget({ monthlyBudget: 10000000, teamOverrides: {} })
    const res = await app.request('/api/alerts')
    const alerts = await res.json()
    const exceeded = alerts.filter((a: { type: string }) => a.type === 'budget_exceeded')
    expect(exceeded.length).toBe(0)
  })
})
