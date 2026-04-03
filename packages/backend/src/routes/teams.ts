import { Hono } from 'hono'
import { store, filterSessions } from '../mock/store.js'
import type { Team, TeamUser } from '@zendash/shared'

export const teams = new Hono()

teams.get('/', (c) => {
  const params = {
    range: c.req.query('range') ?? '30d',
    model: c.req.query('model'),
  }

  const filtered = filterSessions(params)

  const result: Team[] = store.teams.map((t) => {
    const teamSessions = filtered.filter((s) => s.teamId === t.id)
    const completed = teamSessions.filter((s) => s.status === 'completed')
    const totalCost = teamSessions.reduce((sum, s) => sum + s.cost, 0)

    let cacheRead = 0, input = 0
    for (const s of teamSessions) {
      cacheRead += s.cacheRead
      input += s.inputTokens
    }

    // Simple 7-point trend (last 7 segments of the date range)
    const dayMap = new Map<string, number>()
    for (const s of teamSessions) {
      const date = s.timestamp.slice(0, 10)
      dayMap.set(date, (dayMap.get(date) ?? 0) + 1)
    }
    const days = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const trend = days.slice(-7).map(([, count]) => count)

    return {
      id: t.id,
      name: t.name,
      sessions: teamSessions.length,
      cost: Math.round(totalCost * 100) / 100,
      completionRate: teamSessions.length > 0 ? completed.length / teamSessions.length : 0,
      costPerSession: completed.length > 0 ? Math.round((totalCost / completed.length) * 100) / 100 : 0,
      cacheHitRate: (cacheRead + input) > 0 ? cacheRead / (cacheRead + input) : 0,
      trend,
    }
  })

  return c.json(result)
})

teams.get('/:id/users', (c) => {
  const teamId = c.req.param('id')
  const team = store.teams.find((t) => t.id === teamId)
  if (!team) return c.json({ error: 'Team not found' }, 404)

  const params = {
    range: c.req.query('range') ?? '30d',
    team_id: teamId,
    model: c.req.query('model'),
  }

  const filtered = filterSessions(params)
  const teamUsers = store.users.filter((u) => u.teamId === teamId)

  const result: TeamUser[] = teamUsers.map((u) => {
    const userSessions = filtered.filter((s) => s.userId === u.id)
    const completed = userSessions.filter((s) => s.status === 'completed')
    const totalCost = userSessions.reduce((sum, s) => sum + s.cost, 0)
    const lastSession = userSessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]

    return {
      id: u.id,
      email: u.email,
      sessions: userSessions.length,
      cost: Math.round(totalCost * 100) / 100,
      completionRate: userSessions.length > 0 ? completed.length / userSessions.length : 0,
      costPerSession: completed.length > 0 ? Math.round((totalCost / completed.length) * 100) / 100 : 0,
      lastActive: lastSession?.timestamp ?? new Date().toISOString(),
    }
  })

  return c.json(result)
})
