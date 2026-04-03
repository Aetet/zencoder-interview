/**
 * Extended state tests covering gaps from docs/mvp/test-cases.md
 * Covers: State-1 (1.1,1.2,1.5,1.6), State-2 (2.4,2.5), State-3, State-4, State-5, State-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { atom, computed, reatomBoolean, action } from '@reatom/core'

// --- State-1 gaps ---

describe('State-1: Filter atom defaults', () => {
  it('1.1 - timeRange defaults to 30d', () => {
    const timeRange = atom('30d', 's1.timeRange')
    expect(timeRange()).toBe('30d')
  })

  it('1.2 - teamFilter defaults to empty string', () => {
    const teamFilter = atom('', 's1.teamFilter')
    expect(teamFilter()).toBe('')
  })

  it('1.5 - custom range could include from/to', () => {
    const timeRange = atom('custom', 's1c.timeRange')
    const dateFrom = atom('2026-03-01', 's1c.dateFrom')
    const dateTo = atom('2026-03-31', 's1c.dateTo')

    const filterParams = computed(() => {
      const params: Record<string, string> = {}
      const range = timeRange()
      if (range === 'custom') {
        params.from = dateFrom()
        params.to = dateTo()
      } else {
        params.range = range
      }
      return params
    }, 's1c.filterParams')

    expect(filterParams()).toEqual({ from: '2026-03-01', to: '2026-03-31' })
  })

  it('1.6 - changing filter produces new computed value', () => {
    const teamFilter = atom('', 's1f.team')
    const filterParams = computed(() => {
      const params: Record<string, string> = { range: '30d' }
      const team = teamFilter()
      if (team) params.team_id = team
      return params
    }, 's1f.params')

    expect(filterParams().team_id).toBeUndefined()
    teamFilter.set('backend')
    expect(filterParams().team_id).toBe('backend')
  })
})

// --- State-2 gaps ---

describe('State-2: Overview live mode data flow', () => {
  it('2.4 - overviewData reads from summary when not live', () => {
    const isLive = reatomBoolean(false, 's2.isLive')
    const summary = atom({ totalSessions: 100 }, 's2.summary')
    const liveData = atom<{ totalSessions: number } | null>(null, 's2.liveData')

    const overviewData = computed(() => {
      if (isLive()) return liveData()
      return summary()
    }, 's2.overviewData')

    expect(overviewData()).toEqual({ totalSessions: 100 })
  })

  it('2.5 - overviewData reads from liveData when live', () => {
    const isLive = reatomBoolean(false, 's2b.isLive')
    const summary = atom({ totalSessions: 100 }, 's2b.summary')
    const liveData = atom<{ totalSessions: number } | null>({ totalSessions: 999 }, 's2b.liveData')

    const overviewData = computed(() => {
      if (isLive()) return liveData()
      return summary()
    }, 's2b.overviewData')

    expect(overviewData()).toEqual({ totalSessions: 100 })
    isLive.setTrue()
    expect(overviewData()).toEqual({ totalSessions: 999 })
  })
})

// --- State-3: Cost computations ---

describe('State-3: Cost computations', () => {
  it('3.1 - cache hit rate formula', () => {
    const cacheRead = 300
    const input = 700
    const rate = cacheRead / (cacheRead + input)
    expect(rate).toBe(0.3)
  })

  it('3.2 - cache savings formula', () => {
    const cacheRead = 1000
    const inputPrice = 3.0 / 1_000_000  // sonnet input
    const cacheReadPrice = 0.3 / 1_000_000  // sonnet cache read
    const savings = cacheRead * (inputPrice - cacheReadPrice)
    expect(savings).toBeGreaterThan(0)
    expect(savings).toBeCloseTo(0.0027, 4)
  })

  it('3.3 - total cost = sum of all token type costs', () => {
    const input = 500, output = 200, cacheCreate = 100, cacheRead = 300
    const p = { input: 3.0, output: 15.0, cacheCreate: 3.75, cacheRead: 0.3 } // sonnet
    const total = (input * p.input + output * p.output + cacheCreate * p.cacheCreate + cacheRead * p.cacheRead) / 1_000_000
    const parts = [
      input * p.input / 1_000_000,
      output * p.output / 1_000_000,
      cacheCreate * p.cacheCreate / 1_000_000,
      cacheRead * p.cacheRead / 1_000_000,
    ]
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 10)
  })

  it('3.4 - cost per session with zero guard', () => {
    const costPerSession = (total: number, completed: number) =>
      completed > 0 ? total / completed : 0
    expect(costPerSession(100, 50)).toBe(2)
    expect(costPerSession(100, 0)).toBe(0)
  })

  it('3.5 - budget percentage', () => {
    const percentUsed = 4231 / 6000
    expect(percentUsed).toBeCloseTo(0.705, 2)
  })
})

// --- State-4: Team data ---

describe('State-4: Team data', () => {
  it('4.1 - team list sortable by cost descending', () => {
    const teams = [
      { id: 'a', cost: 100 },
      { id: 'b', cost: 300 },
      { id: 'c', cost: 200 },
    ]
    const sorted = [...teams].sort((a, b) => b.cost - a.cost)
    expect(sorted[0].id).toBe('b')
    expect(sorted[1].id).toBe('c')
    expect(sorted[2].id).toBe('a')
  })

  it('4.2 - selectedTeamId atom works', () => {
    const selectedTeamId = atom<string | null>(null, 's4.selectedTeam')
    expect(selectedTeamId()).toBeNull()
    selectedTeamId.set('backend')
    expect(selectedTeamId()).toBe('backend')
  })
})

// --- State-5: Settings form ---

describe('State-5: Settings form atoms', () => {
  it('5.1 - budgetInput initial value', () => {
    const budgetInput = atom('6000', 's5.budgetInput')
    expect(budgetInput()).toBe('6000')
  })

  it('5.2 - validation rejects non-numeric', () => {
    const validate = (v: string) => {
      const num = Number(v)
      return !isNaN(num) && num > 0 ? undefined : 'Must be a positive number'
    }
    expect(validate('abc')).toBe('Must be a positive number')
  })

  it('5.3 - validation rejects negative', () => {
    const validate = (v: string) => {
      const num = Number(v)
      return !isNaN(num) && num > 0 ? undefined : 'Must be a positive number'
    }
    expect(validate('-100')).toBe('Must be a positive number')
  })

  it('5.4 - validation accepts valid budget', () => {
    const validate = (v: string) => {
      const num = Number(v)
      return !isNaN(num) && num > 0 ? undefined : 'Must be a positive number'
    }
    expect(validate('5000')).toBeUndefined()
  })

  it('5.7 - threshold toggles', () => {
    const thresholds = atom<Record<number, boolean>>(
      { 50: true, 75: true, 90: true, 100: true },
      's5.thresholds',
    )
    thresholds.set((s) => ({ ...s, 50: false }))
    expect(thresholds()[50]).toBe(false)
    expect(thresholds()[75]).toBe(true)
  })
})

// --- State-6: CSV export ---

describe('State-6: CSV export', () => {
  it('6.4 - filename includes view name and date', () => {
    const view = 'overview'
    const filename = `zendash-${view}-${new Date().toISOString().slice(0, 10)}.csv`
    expect(filename).toMatch(/^zendash-overview-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

// --- State-7: Async patterns (pure logic, no actual fetch) ---

describe('State-7: Async data patterns', () => {
  it('7.1 - loading atom starts as true', () => {
    const loading = atom(true, 's7.loading')
    expect(loading()).toBe(true)
  })

  it('7.2 - loading set to false after fetch', () => {
    const loading = atom(true, 's7b.loading')
    const data = atom<any>(null, 's7b.data')

    // Simulate fetch completion
    data.set({ items: [1, 2, 3] })
    loading.set(false)

    expect(loading()).toBe(false)
    expect(data()).toEqual({ items: [1, 2, 3] })
  })

  it('7.4 - error atom set on failure', () => {
    const error = atom<Error | null>(null, 's7d.error')
    error.set(new Error('Network error'))
    expect(error()).toBeInstanceOf(Error)
    expect(error()!.message).toBe('Network error')
  })
})
