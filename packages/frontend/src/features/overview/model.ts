import { atom, action, reatomBoolean } from '@reatom/core'
import { api } from '../../shared/api/client'
import { filterParams } from '../../shared/filters/model'
import type { SessionSummary, Insight, QualityTier1, Team, LiveUpdate, DailySessionTrend, DailyCostTrend } from '@zendash/shared'

export const isLive = reatomBoolean(false, 'overview.isLive')

export const overviewSummary = atom<SessionSummary | null>(null, 'overview.summary')
export const overviewInsights = atom<Insight[]>([], 'overview.insights')
export const overviewTeams = atom<Team[]>([], 'overview.teams')
export const overviewQuality = atom<QualityTier1 | null>(null, 'overview.quality')
export const overviewLoading = atom(true, 'overview.loading')

export const fetchOverview = action(async () => {
  overviewLoading.set(true)
  try {
    const params = filterParams()
    const [summary, insights, teams, quality] = await Promise.all([
      api.sessions.summary(params),
      api.insights.list(params),
      api.teams.list(params),
      api.quality.tier1(params),
    ])
    overviewSummary.set(summary)
    overviewInsights.set(insights)
    overviewTeams.set(teams)
    overviewQuality.set(quality)
  } finally {
    overviewLoading.set(false)
  }
}, 'overview.fetch')

// SSE live connection management
let eventSource: EventSource | null = null

// Throttle UI updates to ~15fps (requestAnimationFrame)
let pendingLiveData: FullLivePayload | null = null
let rafId: number | null = null

interface FullLivePayload extends LiveUpdate {
  teams?: Team[]
  insights?: Insight[]
}

function applyLiveUpdate() {
  const data = pendingLiveData
  if (!data) return
  pendingLiveData = null
  rafId = null

  const current = overviewSummary()
  if (current) {
    overviewSummary.set({
      ...current,
      totalSessions: data.totalSessions,
      totalCost: data.totalCost,
      completionRate: data.completionRate,
      activeUsers: data.activeUsers,
      costPerSession: data.costPerSession,
      trend: data.trend.length > 0 ? data.trend : current.trend,
      costTrend: data.costTrend.length > 0 ? data.costTrend : current.costTrend,
    })
  }

  if (data.teams && data.teams.length > 0) {
    overviewTeams.set(data.teams)
  }

  if (data.insights && data.insights.length > 0) {
    overviewInsights.set(data.insights)
  }
}

export const startLive = action(() => {
  stopLive()

  const params = new URLSearchParams(filterParams())
  eventSource = new EventSource(`/api/overview/live?${params}`)

  eventSource.addEventListener('update', (event) => {
    try {
      const data: FullLivePayload = JSON.parse(event.data)
      pendingLiveData = data
      // Coalesce rapid SSE events into a single rAF paint
      if (rafId === null) {
        rafId = requestAnimationFrame(applyLiveUpdate)
      }
    } catch {
      // ignore malformed events
    }
  })

  eventSource.onerror = () => {
    stopLive()
    isLive.setFalse()
  }

  isLive.setTrue()
}, 'overview.startLive')

export const stopLive = action(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  pendingLiveData = null
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  isLive.setFalse()
}, 'overview.stopLive')

export const toggleLive = action(() => {
  if (isLive()) {
    stopLive()
  } else {
    startLive()
  }
}, 'overview.toggleLive')
