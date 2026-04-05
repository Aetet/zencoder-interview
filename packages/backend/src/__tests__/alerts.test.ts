import { describe, it, expect } from 'vitest'
import { generateAlerts, type AlertInput } from '../mock/alerts.js'
import type { MockSession, MockTeam } from '../mock/generator.js'

function makeTeams(...names: string[]): MockTeam[] {
  return names.map(name => ({ id: name.toLowerCase(), name }))
}

function makeSession(teamId: string, cost: number, daysAgo = 0): MockSession {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return {
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    userId: `user-1`,
    teamId,
    model: 'sonnet',
    status: 'completed',
    inputTokens: 100,
    outputTokens: 50,
    cacheCreation: 0,
    cacheRead: 0,
    cost,
    toolCalls: 1,
    toolErrors: 0,
    timestamp: d.toISOString(),
    durationMs: 1000,
  }
}

function makeInput(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    sessions: [],
    teams: makeTeams('Alpha', 'Beta', 'Gamma'),
    budget: 1000,
    thresholds: [50, 75, 90, 100],
    teamBudgets: { alpha: 333, beta: 333, gamma: 334 },
    ...overrides,
  }
}

// --- BD-9.1: Threshold alert fires when spend > threshold × budget ---

describe('BD-9: Threshold alerts', () => {
  it('9.1 - fires when spend exceeds threshold', () => {
    const input = makeInput({
      sessions: [makeSession('alpha', 600)],
      budget: 1000,
      thresholds: [50],
    })
    const alerts = generateAlerts(input)
    const threshold = alerts.find(a => a.type === 'threshold_reached')
    expect(threshold).toBeDefined()
    expect(threshold!.title).toContain('50%')
  })

  it('9.2 - severity: 100% = error, 90% = warning, else info', () => {
    const sessions = [makeSession('alpha', 1000)]
    const alerts100 = generateAlerts(makeInput({ sessions, thresholds: [100] }))
    const alerts90 = generateAlerts(makeInput({ sessions, thresholds: [90] }))
    const alerts50 = generateAlerts(makeInput({ sessions, thresholds: [50] }))

    expect(alerts100.find(a => a.type === 'threshold_reached')!.severity).toBe('error')
    expect(alerts90.find(a => a.type === 'threshold_reached')!.severity).toBe('warning')
    expect(alerts50.find(a => a.type === 'threshold_reached')!.severity).toBe('info')
  })

  it('9.3 - no alert when spend below threshold', () => {
    const input = makeInput({
      sessions: [makeSession('alpha', 100)],
      budget: 1000,
      thresholds: [90],
    })
    const alerts = generateAlerts(input)
    const threshold = alerts.find(a => a.type === 'threshold_reached')
    expect(threshold).toBeUndefined()
  })

  it('9.10 - threshold alerts have teamId: null', () => {
    const input = makeInput({
      sessions: [makeSession('alpha', 600)],
      thresholds: [50],
    })
    const alerts = generateAlerts(input)
    const threshold = alerts.find(a => a.type === 'threshold_reached')
    expect(threshold!.teamId).toBeNull()
  })
})

// --- BD-9.4-9.7: Team budget exceeded ---

describe('BD-9: Team budget exceeded', () => {
  it('9.4 - auto-distributed budget exceeded', () => {
    const input = makeInput({
      sessions: [makeSession('alpha', 150)],
      budget: 300,
      thresholds: [],
      teamBudgets: { alpha: 100, beta: 100, gamma: 100 },
    })
    const alerts = generateAlerts(input)
    const exceeded = alerts.find(a => a.type === 'budget_exceeded' && a.teamId === 'alpha')
    expect(exceeded).toBeDefined()
    expect(exceeded!.description).toContain('150.00')
    expect(exceeded!.description).toContain('100.00')
  })

  it('9.5 - override budget exceeded', () => {
    const input = makeInput({
      sessions: [makeSession('alpha', 80)],
      budget: 300,
      thresholds: [],
      teamBudgets: { alpha: 50, beta: 125, gamma: 125 },
    })
    const alerts = generateAlerts(input)
    const exceeded = alerts.find(a => a.type === 'budget_exceeded' && a.teamId === 'alpha')
    expect(exceeded).toBeDefined()
    expect(exceeded!.description).toContain('50.00')
  })

  it('9.6 - team within budget → no alert', () => {
    const input = makeInput({
      sessions: [makeSession('alpha', 40)],
      budget: 300,
      thresholds: [],
      teamBudgets: { alpha: 100, beta: 100, gamma: 100 },
    })
    const alerts = generateAlerts(input)
    const exceeded = alerts.find(a => a.type === 'budget_exceeded' && a.teamId === 'alpha')
    expect(exceeded).toBeUndefined()
  })

  it('9.7 - override changes allocation, causing another team to exceed', () => {
    // Budget $300, 3 teams. Override alpha to $200 → beta,gamma get $50 each
    const input = makeInput({
      sessions: [makeSession('beta', 60)],
      budget: 300,
      thresholds: [],
      teamBudgets: { alpha: 200, beta: 50, gamma: 50 },
    })
    const alerts = generateAlerts(input)
    const exceeded = alerts.find(a => a.type === 'budget_exceeded' && a.teamId === 'beta')
    expect(exceeded).toBeDefined()
    expect(exceeded!.description).toContain('60.00')
    expect(exceeded!.description).toContain('50.00')
  })

  it('9.10 - team alerts have correct teamId', () => {
    const input = makeInput({
      sessions: [makeSession('beta', 200)],
      budget: 300,
      thresholds: [],
      teamBudgets: { alpha: 100, beta: 100, gamma: 100 },
    })
    const alerts = generateAlerts(input)
    const exceeded = alerts.find(a => a.type === 'budget_exceeded')
    expect(exceeded!.teamId).toBe('beta')
  })
})

// --- BD-9.8-9.9: Spend spikes ---

describe('BD-9: Spend spikes', () => {
  it('9.8 - spike when daily > 2× weekly avg', () => {
    // 7 days of $4/day average, today $10
    const sessions = [
      ...Array.from({ length: 7 }, (_, i) => makeSession('alpha', 4, i + 1)),
      makeSession('alpha', 10, 0), // today
    ]
    const input = makeInput({
      sessions,
      thresholds: [],
      teamBudgets: { alpha: 10000 }, // high budget so no budget_exceeded
    })
    const alerts = generateAlerts(input)
    const spike = alerts.find(a => a.type === 'spend_spike' && a.teamId === 'alpha')
    expect(spike).toBeDefined()
    expect(spike!.severity).toBe('warning')
  })

  it('9.9 - no spike when daily within normal range', () => {
    const sessions = [
      ...Array.from({ length: 7 }, (_, i) => makeSession('alpha', 4, i + 1)),
      makeSession('alpha', 5, 0), // today — 5 vs avg 4 = 1.25x, below 2x
    ]
    const input = makeInput({
      sessions,
      thresholds: [],
      teamBudgets: { alpha: 10000 },
    })
    const alerts = generateAlerts(input)
    const spike = alerts.find(a => a.type === 'spend_spike' && a.teamId === 'alpha')
    expect(spike).toBeUndefined()
  })
})

// --- BD-9.11-9.12: Ordering and limits ---

describe('BD-9: Ordering and limits', () => {
  it('9.11 - alerts sorted by timestamp descending', () => {
    const input = makeInput({
      sessions: [
        makeSession('alpha', 500),
        makeSession('beta', 500),
        makeSession('gamma', 500),
      ],
      budget: 100,
      thresholds: [50, 75, 90, 100],
      teamBudgets: { alpha: 10, beta: 10, gamma: 10 },
    })
    const alerts = generateAlerts(input)
    for (let i = 1; i < alerts.length; i++) {
      expect(new Date(alerts[i - 1].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(alerts[i].timestamp).getTime())
    }
  })

  it('9.12 - max 25 alerts returned', () => {
    // Create many teams that all exceed budget
    const teams = Array.from({ length: 50 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }))
    const sessions = teams.map(t => makeSession(t.id, 100))
    const teamBudgets: Record<string, number> = {}
    for (const t of teams) teamBudgets[t.id] = 1

    const input: AlertInput = {
      sessions,
      teams,
      budget: 100,
      thresholds: [50, 75, 90, 100],
      teamBudgets,
    }
    const alerts = generateAlerts(input)
    expect(alerts.length).toBeLessThanOrEqual(25)
  })
})
