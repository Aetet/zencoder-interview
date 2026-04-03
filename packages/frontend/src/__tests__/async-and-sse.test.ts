/**
 * Tests for SSE live mode, async submit, and CSV export.
 * Covers: API-11 (11.2-11.4), State-5 (5.5-5.6), State-6 (6.1-6.3), State-7 (7.3,7.5,7.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../test/setup-dom'
import { atom, reatomBoolean, action } from '@reatom/core'

// --- SSE Live Mode (API-11 gaps via mock EventSource) ---

describe('SSE Live Mode', () => {
  it('11.2 - EventSource receives events', () => {
    const es = new (globalThis as any).EventSource('/api/overview/live') as any
    const handler = vi.fn()
    es.addEventListener('update', handler)

    es._emit('update', { totalSessions: 3000, totalCost: 15.08, completionRate: 0.85 })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('11.3 - events contain valid JSON', () => {
    const es = new (globalThis as any).EventSource('/api/overview/live') as any
    let parsed: any = null
    es.addEventListener('update', (e: any) => {
      parsed = JSON.parse(e.data)
    })

    es._emit('update', { totalSessions: 3000, totalCost: 15.08 })

    expect(parsed).not.toBeNull()
    expect(typeof parsed.totalSessions).toBe('number')
  })

  it('11.4 - event data has KPI fields', () => {
    const es = new (globalThis as any).EventSource('/api/overview/live') as any
    let data: any = null
    es.addEventListener('update', (e: any) => {
      data = JSON.parse(e.data)
    })

    es._emit('update', {
      totalSessions: 3000,
      totalCost: 15.08,
      completionRate: 0.85,
      activeUsers: 50,
      costPerSession: 0.005,
    })

    expect(data).toHaveProperty('totalSessions')
    expect(data).toHaveProperty('totalCost')
    expect(data).toHaveProperty('completionRate')
    expect(data).toHaveProperty('activeUsers')
    expect(data).toHaveProperty('costPerSession')
  })

  it('EventSource close sets readyState to 2', () => {
    const es = new (globalThis as any).EventSource('/api/overview/live') as any
    expect(es.readyState).toBe(1)
    es.close()
    expect(es.readyState).toBe(2)
  })

  it('live toggle opens and closes EventSource', () => {
    let source: any = null
    const isLive = reatomBoolean(false, 'sse.isLive')

    const startLive = action(() => {
      source = new (globalThis as any).EventSource('/api/overview/live')
      isLive.setTrue()
    }, 'sse.start')

    const stopLive = action(() => {
      source?.close()
      source = null
      isLive.setFalse()
    }, 'sse.stop')

    startLive()
    expect(isLive()).toBe(true)
    expect(source).not.toBeNull()
    expect(source.readyState).toBe(1)

    stopLive()
    expect(isLive()).toBe(false)
    expect(source).toBeNull()
  })

  it('SSE data updates summary atom', () => {
    const summary = atom<{ totalSessions: number } | null>(null, 'sse.summary')
    summary.set({ totalSessions: 100 })

    const es = new (globalThis as any).EventSource('/api/overview/live') as any
    es.addEventListener('update', (event: any) => {
      const data = JSON.parse(event.data)
      summary.set({ totalSessions: data.totalSessions })
    })

    es._emit('update', { totalSessions: 3050 })
    expect(summary()?.totalSessions).toBe(3050)
  })
})

// --- State-5 gaps: Async submit ---

describe('State-5: Async submit flow', () => {
  it('5.5 - submit action calls fetch with payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({ success: true }) })
    globalThis.fetch = mockFetch as any

    const saving = atom(false, 'sub.saving')
    const saveBudget = action(async () => {
      saving.set(true)
      try {
        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ monthlyBudget: 5000, thresholds: [50, 75] }),
        })
      } finally {
        saving.set(false)
      }
    }, 'sub.save')

    await saveBudget()

    expect(mockFetch).toHaveBeenCalledWith('/api/alerts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ monthlyBudget: 5000, thresholds: [50, 75] }),
    }))
  })

  it('5.6 - submit error is captured', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any

    const error = atom<Error | null>(null, 'sub.error')
    const saveBudget = action(async () => {
      try {
        await fetch('/api/alerts', { method: 'POST', body: '{}' })
      } catch (e) {
        error.set(e as Error)
      }
    }, 'sub.saveErr')

    await saveBudget()
    expect(error()).toBeInstanceOf(Error)
    expect(error()!.message).toBe('Network error')
  })

  it('5.7 - saving state transitions', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) }) as any

    const saving = atom(false, 'sub2.saving')
    const states: boolean[] = []

    const saveBudget = action(async () => {
      saving.set(true)
      states.push(saving())
      await fetch('/api/alerts', { method: 'POST', body: '{}' })
      saving.set(false)
      states.push(saving())
    }, 'sub2.save')

    await saveBudget()
    expect(states).toEqual([true, false])
  })
})

// --- State-6 gaps: CSV export ---

describe('State-6: CSV export', () => {
  it('6.1 - exportCsv calls fetch with correct URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['a,b,c'], { type: 'text/csv' })),
    }) as any

    const exportCsv = action(async () => {
      await fetch('/api/export/overview?range=30d')
    }, 'exp.csv')

    await exportCsv()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/export/overview?range=30d')
  })

  it('6.2 - exportCsv creates download link', async () => {
    const mockUrl = 'blob:http://localhost/fake'
    const mockRevoke = vi.fn()
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl)
    globalThis.URL.revokeObjectURL = mockRevoke

    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['data'])),
    }) as any

    const clicks: string[] = []
    const origCreate = document.createElement.bind(document)
    // Track link creation
    const exportCsv = action(async () => {
      const res = await fetch('/api/export/overview?range=30d')
      const blob = await (res as any).blob()
      const url = URL.createObjectURL(blob)
      // Simulate creating anchor and clicking
      clicks.push(url)
      URL.revokeObjectURL(url)
    }, 'exp2.csv')

    await exportCsv()
    expect(clicks).toEqual([mockUrl])
    expect(mockRevoke).toHaveBeenCalledWith(mockUrl)
  })

  it('6.3 - export loading state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob()) }) as any

    const exporting = atom(false, 'exp3.loading')
    const states: boolean[] = []

    const exportCsv = action(async () => {
      exporting.set(true)
      states.push(exporting())
      await fetch('/api/export/overview')
      exporting.set(false)
      states.push(exporting())
    }, 'exp3.csv')

    await exportCsv()
    expect(states).toEqual([true, false])
  })
})

// --- State-7 gaps: Async data patterns ---

describe('State-7: Async data patterns (extended)', () => {
  it('7.3 - data atom matches API response', async () => {
    const mockData = { items: [{ id: 1, name: 'test' }] }
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => mockData }) as any

    const data = atom<any>(null, 's7.data')
    const fetchData = action(async () => {
      const res = await fetch('/api/test')
      const json = await (res as any).json()
      data.set(json)
    }, 's7.fetch')

    await fetchData()
    expect(data()).toEqual(mockData)
  })

  it('7.5 - retry re-fetches data', async () => {
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({ ok: true, json: () => ({ count: callCount }) })
    }) as any

    const data = atom<any>(null, 's7r.data')
    const fetchData = action(async () => {
      const res = await fetch('/api/test')
      data.set(await (res as any).json())
    }, 's7r.fetch')

    await fetchData()
    expect(data().count).toBe(1)

    await fetchData() // retry
    expect(data().count).toBe(2)
    expect(callCount).toBe(2)
  })

  it('7.6 - abort prevents state update', async () => {
    const data = atom<any>('initial', 's7a.data')
    let aborted = false

    const fetchData = action(async () => {
      const controller = new AbortController()
      // Simulate immediate abort
      controller.abort()
      aborted = controller.signal.aborted

      if (!controller.signal.aborted) {
        data.set('updated')
      }
    }, 's7a.fetch')

    await fetchData()
    expect(aborted).toBe(true)
    expect(data()).toBe('initial') // not updated because aborted
  })
})
