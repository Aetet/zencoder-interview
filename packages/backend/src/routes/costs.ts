import { Hono } from 'hono'
import { store, filterSessions } from '../mock/store.js'
import { MODEL_PRICING } from '../mock/pricing.js'
import type { CostBreakdown, CacheData, BudgetData } from '@zendash/shared'

export const costs = new Hono()

costs.get('/breakdown', (c) => {
  const params = {
    range: c.req.query('range') ?? '30d',
    team_id: c.req.query('team_id'),
    user_id: c.req.query('user_id'),
    model: c.req.query('model'),
  }

  const filtered = filterSessions(params)
  const totalCost = filtered.reduce((sum, s) => sum + s.cost, 0)
  const completed = filtered.filter((s) => s.status === 'completed')

  // By team
  const teamCosts = new Map<string, number>()
  for (const s of filtered) {
    teamCosts.set(s.teamId, (teamCosts.get(s.teamId) ?? 0) + s.cost)
  }
  const byTeam = store.teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    cost: Math.round((teamCosts.get(t.id) ?? 0) * 100) / 100,
  }))

  // By model
  const modelCosts = new Map<string, number>()
  for (const s of filtered) {
    modelCosts.set(s.model, (modelCosts.get(s.model) ?? 0) + s.cost)
  }
  const byModel = Array.from(modelCosts.entries()).map(([model, cost]) => ({
    model,
    cost: Math.round(cost * 100) / 100,
  }))

  // By token type
  let inputTotal = 0, outputTotal = 0, cacheCreateTotal = 0, cacheReadTotal = 0
  for (const s of filtered) {
    const p = MODEL_PRICING[s.model]
    inputTotal += (s.inputTokens * p.input) / 1_000_000
    outputTotal += (s.outputTokens * p.output) / 1_000_000
    cacheCreateTotal += (s.cacheCreation * p.cacheCreate) / 1_000_000
    cacheReadTotal += (s.cacheRead * p.cacheRead) / 1_000_000
  }

  // Daily token trend
  const dayTokens = new Map<string, { input: number; output: number; cacheCreation: number; cacheRead: number }>()
  for (const s of filtered) {
    const date = s.timestamp.slice(0, 10)
    const p = MODEL_PRICING[s.model]
    const entry = dayTokens.get(date) ?? { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 }
    entry.input += (s.inputTokens * p.input) / 1_000_000
    entry.output += (s.outputTokens * p.output) / 1_000_000
    entry.cacheCreation += (s.cacheCreation * p.cacheCreate) / 1_000_000
    entry.cacheRead += (s.cacheRead * p.cacheRead) / 1_000_000
    dayTokens.set(date, entry)
  }

  const result: CostBreakdown = {
    total: Math.round(totalCost * 100) / 100,
    byTeam,
    byModel,
    byTokenType: {
      input: Math.round(inputTotal * 100) / 100,
      output: Math.round(outputTotal * 100) / 100,
      cacheCreation: Math.round(cacheCreateTotal * 100) / 100,
      cacheRead: Math.round(cacheReadTotal * 100) / 100,
    },
    tokenTrend: Array.from(dayTokens.entries())
      .map(([date, t]) => ({
        date,
        input: Math.round(t.input * 100) / 100,
        output: Math.round(t.output * 100) / 100,
        cacheCreation: Math.round(t.cacheCreation * 100) / 100,
        cacheRead: Math.round(t.cacheRead * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    costPerSession: completed.length > 0 ? Math.round((totalCost / completed.length) * 100) / 100 : 0,
  }

  return c.json(result)
})

costs.get('/cache', (c) => {
  const params = {
    range: c.req.query('range') ?? '30d',
    team_id: c.req.query('team_id'),
    model: c.req.query('model'),
  }

  const filtered = filterSessions(params)

  let totalCacheRead = 0, totalInput = 0
  for (const s of filtered) {
    totalCacheRead += s.cacheRead
    totalInput += s.inputTokens
  }
  const orgRate = (totalCacheRead + totalInput) > 0 ? totalCacheRead / (totalCacheRead + totalInput) : 0

  // Savings: cost if cache reads had been full input tokens
  let savings = 0
  for (const s of filtered) {
    const p = MODEL_PRICING[s.model]
    savings += (s.cacheRead * (p.input - p.cacheRead)) / 1_000_000
  }

  // By team
  const teamData = new Map<string, { cacheRead: number; input: number }>()
  for (const s of filtered) {
    const entry = teamData.get(s.teamId) ?? { cacheRead: 0, input: 0 }
    entry.cacheRead += s.cacheRead
    entry.input += s.inputTokens
    teamData.set(s.teamId, entry)
  }
  const byTeam = store.teams.map((t) => {
    const d = teamData.get(t.id) ?? { cacheRead: 0, input: 0 }
    return {
      teamId: t.id,
      teamName: t.name,
      rate: (d.cacheRead + d.input) > 0 ? d.cacheRead / (d.cacheRead + d.input) : 0,
    }
  })

  // Daily trend
  const dayCache = new Map<string, { cacheRead: number; input: number }>()
  for (const s of filtered) {
    const date = s.timestamp.slice(0, 10)
    const entry = dayCache.get(date) ?? { cacheRead: 0, input: 0 }
    entry.cacheRead += s.cacheRead
    entry.input += s.inputTokens
    dayCache.set(date, entry)
  }
  const trend = Array.from(dayCache.entries())
    .map(([date, d]) => ({
      date,
      rate: (d.cacheRead + d.input) > 0 ? d.cacheRead / (d.cacheRead + d.input) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const result: CacheData = {
    orgCacheHitRate: orgRate,
    savings: Math.round(savings * 100) / 100,
    byTeam,
    trend,
  }

  return c.json(result)
})

costs.get('/budget', (c) => {
  const allSessions = filterSessions({ range: '30d' })
  const currentSpend = allSessions.reduce((sum, s) => sum + s.cost, 0)
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const projected = dayOfMonth > 0 ? (currentSpend / dayOfMonth) * daysInMonth : currentSpend

  // Team budgets (distribute evenly as baseline)
  const teamBudgetBase = store.budget.monthlyBudget / store.teams.length
  const teamCosts = new Map<string, number>()
  for (const s of allSessions) {
    teamCosts.set(s.teamId, (teamCosts.get(s.teamId) ?? 0) + s.cost)
  }

  const result: BudgetData = {
    monthlyBudget: store.budget.monthlyBudget,
    currentSpend: Math.round(currentSpend * 100) / 100,
    projected: Math.round(projected * 100) / 100,
    percentUsed: store.budget.monthlyBudget > 0 ? currentSpend / store.budget.monthlyBudget : 0,
    thresholds: store.budget.thresholds,
    teamBudgets: store.teams.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      budget: Math.round(teamBudgetBase * 100) / 100,
      spent: Math.round((teamCosts.get(t.id) ?? 0) * 100) / 100,
    })),
  }

  return c.json(result)
})
