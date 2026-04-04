import { atom, computed, action, reatomBoolean, reatomRoute, wrap, withChangeHook } from '@reatom/core'
import { api } from '../../shared/api/client'
import { filterParams } from '../../shared/filters/model'
import type { Insight, QualityTier1, Team, LiveUpdate, DailySessionTrend, DailyCostTrend } from '@zendash/shared'

interface FullLivePayload extends LiveUpdate {
  teams?: Team[]
  insights?: Insight[]
}

export const overviewRoute = reatomRoute({
  path: 'overview',
  async loader() {
    const params = filterParams()
    const [summary, insights, teams, quality] = await Promise.all([
      wrap(api.sessions.summary(params)),
      wrap(api.insights.list(params)),
      wrap(api.teams.list(params)),
      wrap(api.quality.tier1(params)),
    ])
    return { summary, insights, teams, quality }
  },
}).extend((route) => {
  const INITIAL = {
    summary: {
      totalSessions: 0, completedSessions: 0, completionRate: 0,
      activeUsers: 0, totalUsers: 0, adoptionRate: 0,
      costPerSession: 0, totalCost: 0, trend: [] as DailySessionTrend[], costTrend: [] as DailyCostTrend[],
    },
    insights: [] as Insight[],
    teams: [] as Team[],
    quality: null as QualityTier1 | null,
  }

  function data() {
    return route.loader.data() ?? INITIAL
  }

  // Live override atoms
  const liveKpis = atom<{
    totalSessions: number; totalCost: number; completionRate: number
    activeUsers: number; costPerSession: number
  } | null>(null, 'overview.liveKpis')
  const liveTrend = atom<DailySessionTrend[] | null>(null, 'overview.liveTrend')
  const liveCostTrend = atom<DailyCostTrend[] | null>(null, 'overview.liveCostTrend')
  const liveInsights = atom<Insight[] | null>(null, 'overview.liveInsights')
  const liveTeams = atom<Team[] | null>(null, 'overview.liveTeams')

  const isLive = reatomBoolean(false, 'overview.isLive')

  // Computed KPIs
  const totalSessions = computed(() => liveKpis()?.totalSessions ?? data().summary.totalSessions, 'overview.totalSessions')
  const totalCost = computed(() => liveKpis()?.totalCost ?? data().summary.totalCost, 'overview.totalCost')
  const completionRate = computed(() => liveKpis()?.completionRate ?? data().summary.completionRate, 'overview.completionRate')
  const activeUsers = computed(() => liveKpis()?.activeUsers ?? data().summary.activeUsers, 'overview.activeUsers')
  const totalUsers = computed(() => data().summary.totalUsers, 'overview.totalUsers')
  const adoptionRate = computed(() => data().summary.adoptionRate, 'overview.adoptionRate')
  const costPerSession = computed(() => liveKpis()?.costPerSession ?? data().summary.costPerSession, 'overview.costPerSession')
  const sessionTrend = computed(() => liveTrend() ?? data().summary.trend, 'overview.sessionTrend')
  const costTrend = computed(() => liveCostTrend() ?? data().summary.costTrend, 'overview.costTrend')
  const insightsList = computed(() => liveInsights() ?? data().insights, 'overview.insightsList')
  const teams = computed(() => liveTeams() ?? data().teams, 'overview.teams')

  // SSE
  let eventSource: EventSource | null = null
  let pendingLiveData: FullLivePayload | null = null
  let rafId: number | null = null

  function applyLiveUpdate() {
    const d = pendingLiveData
    if (!d) return
    pendingLiveData = null
    rafId = null

    liveKpis.set({
      totalSessions: d.totalSessions, totalCost: d.totalCost,
      completionRate: d.completionRate, activeUsers: d.activeUsers,
      costPerSession: d.costPerSession,
    })
    if (d.trend.length > 0) liveTrend.set(d.trend)
    if (d.costTrend.length > 0) liveCostTrend.set(d.costTrend)
    if (d.insights && d.insights.length > 0) liveInsights.set(d.insights)
    if (d.teams) liveTeams.set(d.teams)
  }

  const startLive = action(() => {
    stopLive()
    const params = new URLSearchParams(filterParams())
    eventSource = new EventSource(`/api/overview/live?${params}`)
    eventSource.addEventListener('update', (event) => {
      try {
        pendingLiveData = JSON.parse(event.data)
        if (rafId === null) rafId = requestAnimationFrame(applyLiveUpdate)
      } catch { /* ignore */ }
    })
    eventSource.onerror = () => { stopLive(); isLive.setFalse() }
    isLive.setTrue()
  }, 'overview.startLive')

  const stopLive = action(() => {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
    pendingLiveData = null
    if (eventSource) { eventSource.close(); eventSource = null }
    isLive.setFalse()
    liveKpis.set(null)
    liveTrend.set(null)
    liveCostTrend.set(null)
    liveInsights.set(null)
    liveTeams.set(null)
  }, 'overview.stopLive')

  const toggleLive = action(() => {
    if (isLive()) stopLive()
    else startLive()
  }, 'overview.toggleLive')

  // Stop live mode when navigating away from overview
  route.match.extend(withChangeHook((isMatch) => {
    if (!isMatch && isLive()) stopLive()
  }))

  return {
    isLive, totalSessions, totalCost, completionRate, activeUsers,
    totalUsers, adoptionRate, costPerSession, sessionTrend, costTrend,
    insightsList, teams, startLive, stopLive, toggleLive,
  }
})
