import { describe, it, expect, beforeEach } from 'vitest'
import app from '../app.js'
import { resetBudget } from './setup.js'

function postBudget(body: Record<string, unknown>) {
  return app.request('/api/budgets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  resetBudget()
})

describe('GET /api/budgets', () => {
  it('returns current budget config', async () => {
    const res = await app.request('/api/budgets')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.monthlyBudget).toBe(6000)
    expect(body.teamOverrides).toEqual({})
  })
})

describe('POST /api/budgets — validation', () => {
  it('rejects negative budget', async () => {
    const res = await postBudget({ monthlyBudget: -100 })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
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
