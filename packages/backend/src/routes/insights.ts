import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { filterQuerySchema } from '@zendash/shared/schemas'
import { store, filterSessions } from '../mock/store.js'
import type { Insight } from '@zendash/shared'

export const insights = new Hono()
  .get('/', zValidator('query', filterQuerySchema), (c) => {
    const { range, team_id, model } = c.req.valid('query')
    const params = { range: range ?? '30d', team_id, model }

    const filtered = filterSessions(params)
    const result: Insight[] = []

    // 1. Highest cost team
    const teamCosts = new Map<string, number>()
    for (const s of filtered) {
      teamCosts.set(s.teamId, (teamCosts.get(s.teamId) ?? 0) + s.cost)
    }
    const avgTeamCost = filtered.reduce((s, x) => s + x.cost, 0) / store.teams.length
    let maxTeam = '', maxCost = 0
    for (const [teamId, cost] of teamCosts) {
      if (cost > maxCost) { maxTeam = teamId; maxCost = cost }
    }
    const maxTeamName = store.teams.find((t) => t.id === maxTeam)?.name ?? maxTeam
    const pctAbove = avgTeamCost > 0 ? Math.round(((maxCost - avgTeamCost) / avgTeamCost) * 100) : 0

    result.push({
      type: 'highCostTeam',
      title: `${maxTeamName} spent $${Math.round(maxCost).toLocaleString()} — ${pctAbove}% above avg`,
      description: `Team "${maxTeamName}" has the highest cost this period`,
      severity: 'warning',
      link: `/costs?team=${maxTeam}`,
    })

    // 2. Lowest cache hit rate
    const teamCache = new Map<string, { cacheRead: number; input: number }>()
    for (const s of filtered) {
      const entry = teamCache.get(s.teamId) ?? { cacheRead: 0, input: 0 }
      entry.cacheRead += s.cacheRead
      entry.input += s.inputTokens
      teamCache.set(s.teamId, entry)
    }

    let totalCacheRead = 0, totalInput = 0
    for (const s of filtered) { totalCacheRead += s.cacheRead; totalInput += s.inputTokens }
    const orgRate = (totalCacheRead + totalInput) > 0 ? totalCacheRead / (totalCacheRead + totalInput) : 0

    let worstTeam = '', worstRate = 1
    for (const [teamId, d] of teamCache) {
      const rate = (d.cacheRead + d.input) > 0 ? d.cacheRead / (d.cacheRead + d.input) : 0
      if (rate < worstRate) { worstTeam = teamId; worstRate = rate }
    }
    const worstTeamName = store.teams.find((t) => t.id === worstTeam)?.name ?? worstTeam

    result.push({
      type: 'lowCacheRate',
      title: `${worstTeamName} cache hit rate: ${Math.round(worstRate * 100)}% vs ${Math.round(orgRate * 100)}% avg`,
      description: 'Low cache utilization may be increasing costs',
      severity: 'error',
      link: `/costs?team=${worstTeam}`,
    })

    // 3. Most expensive session
    const sorted = [...filtered].sort((a, b) => b.cost - a.cost)
    const expensive = sorted[0]
    if (expensive) {
      const avgCost = filtered.reduce((s, x) => s + x.cost, 0) / filtered.length
      const multiple = avgCost > 0 ? Math.round(expensive.cost / avgCost) : 0
      result.push({
        type: 'expensiveSession',
        title: `Session ${expensive.id.slice(0, 8)} cost $${expensive.cost.toFixed(2)} — ${multiple}x avg`,
        description: 'Anomalous session detected; review recommended',
        severity: 'info',
        link: `/overview`,
      })
    }

    return c.json(result)
  })
