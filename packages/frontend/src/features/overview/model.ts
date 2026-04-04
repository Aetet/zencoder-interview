import { atom, computed, action, effect, reatomBoolean, withAsyncData, wrap } from "@reatom/core"
import { api } from "../../shared/api/client"
import { filterParams } from "../../shared/filters/model"
import type { Insight, QualityTier1, Team, LiveUpdate, DailySessionTrend, DailyCostTrend } from "@zendash/shared"

// ---------------------------------------------------------------------------
// 1. Data resource — fetches on filter change, only while subscribed
// ---------------------------------------------------------------------------

export const overviewResource = computed(async () => {
  const params = filterParams()
  const [summary, insights, teams, quality] = await Promise.all([
    wrap(api.sessions.summary(params)),
    wrap(api.insights.list(params)),
    wrap(api.teams.list(params)),
    wrap(api.quality.tier1(params)),
  ])
  return { summary, insights, teams, quality }
}, "overview.resource").extend(withAsyncData({ initState: null }))

// ---------------------------------------------------------------------------
// 2. Live override atoms — SSE writes here, never into overviewResource
// ---------------------------------------------------------------------------

export const isLive = reatomBoolean(false, "overview.isLive")

const liveKpis = atom<{
  totalSessions: number
  totalCost: number
  completionRate: number
  activeUsers: number
  costPerSession: number
} | null>(null, "overview.liveKpis")

const liveTrend = atom<DailySessionTrend[] | null>(null, "overview.liveTrend")
const liveCostTrend = atom<DailyCostTrend[] | null>(null, "overview.liveCostTrend")
const liveInsights = atom<Insight[] | null>(null, "overview.liveInsights")

// ---------------------------------------------------------------------------
// 3. Public computed atoms — pick live data if live, else resource data
// ---------------------------------------------------------------------------

const summaryData = computed(() => overviewResource.data()?.summary ?? null, "overview.summaryData")

export const totalSessions = computed(() => {
  const lk = liveKpis()
  return lk ? lk.totalSessions : summaryData()?.totalSessions ?? 0
}, "overview.totalSessions")

export const totalCost = computed(() => {
  const lk = liveKpis()
  return lk ? lk.totalCost : summaryData()?.totalCost ?? 0
}, "overview.totalCost")

export const completionRate = computed(() => {
  const lk = liveKpis()
  return lk ? lk.completionRate : summaryData()?.completionRate ?? 0
}, "overview.completionRate")

export const activeUsers = computed(() => {
  const lk = liveKpis()
  return lk ? lk.activeUsers : summaryData()?.activeUsers ?? 0
}, "overview.activeUsers")

export const totalUsers = computed(() => summaryData()?.totalUsers ?? 0, "overview.totalUsers")

export const adoptionRate = computed(() => summaryData()?.adoptionRate ?? 0, "overview.adoptionRate")

export const costPerSession = computed(() => {
  const lk = liveKpis()
  return lk ? lk.costPerSession : summaryData()?.costPerSession ?? 0
}, "overview.costPerSession")

export const sessionTrend = computed(() => {
  return liveTrend() ?? summaryData()?.trend ?? []
}, "overview.sessionTrend")

export const costTrend = computed(() => {
  return liveCostTrend() ?? summaryData()?.costTrend ?? []
}, "overview.costTrend")

export const insightsList = computed(() => {
  return liveInsights() ?? overviewResource.data()?.insights ?? []
}, "overview.insights")

export const qualityData = computed(() => overviewResource.data()?.quality ?? null, "overview.quality")

// ---------------------------------------------------------------------------
// 4. Teams
//
//    freshestTeams: plain JS array, updated by SSE every frame. Zero cost.
//    teamsAtom:     single atom<Team[]>, updated every TEAM_FLUSH_MS. Drives the component.
// ---------------------------------------------------------------------------

let freshestTeams: Team[] = []

export const teamsAtom = atom<Team[]>([], "overview.teams")

// Sync from resource on initial load
effect(() => {
  overviewResource()
  const data = overviewResource.data()
  const raw = data?.teams
  if (!raw || raw.length === 0) return
  freshestTeams = raw
  teamsAtom.set(raw)
}, "overview.syncTeamsEffect")

// ---------------------------------------------------------------------------
// 5. Live mode — SSE
//    KPIs: update every rAF frame via live override atoms
//    Teams: SSE writes to freshestTeams (free). Timer flushes to sortedTeams every 300ms.
// ---------------------------------------------------------------------------

let eventSource: EventSource | null = null
let pendingLiveData: FullLivePayload | null = null
let rafId: number | null = null
let teamFlushTimer: ReturnType<typeof setInterval> | null = null
const TEAM_FLUSH_MS = 500

interface FullLivePayload extends LiveUpdate {
  teams?: Team[]
  insights?: Insight[]
}

function applyLiveUpdate() {
  const data = pendingLiveData
  if (!data) return
  pendingLiveData = null
  rafId = null

  // KPIs — every frame
  liveKpis.set({
    totalSessions: data.totalSessions,
    totalCost: data.totalCost,
    completionRate: data.completionRate,
    activeUsers: data.activeUsers,
    costPerSession: data.costPerSession,
  })

  if (data.trend.length > 0) liveTrend.set(data.trend)
  if (data.costTrend.length > 0) liveCostTrend.set(data.costTrend)
  if (data.insights && data.insights.length > 0) liveInsights.set(data.insights)

  // Teams — just store in plain JS, zero cost
  if (data.teams) {
    freshestTeams = data.teams
  }
}

function flushTeamsToRender() {
  if (freshestTeams.length === 0) return
  teamsAtom.set(freshestTeams)
}

export const startLive = action(() => {
  stopLive()
  const params = new URLSearchParams(filterParams())
  eventSource = new EventSource(`/api/overview/live?${params}`)

  eventSource.addEventListener("update", event => {
    try {
      pendingLiveData = JSON.parse(event.data)
      if (rafId === null) {
        rafId = requestAnimationFrame(applyLiveUpdate)
      }
    } catch {
      /* ignore */
    }
  })

  eventSource.onerror = () => {
    stopLive()
    isLive.setFalse()
  }

  // Start team flush interval
  teamFlushTimer = setInterval(flushTeamsToRender, TEAM_FLUSH_MS)

  isLive.setTrue()
}, "overview.startLive")

export const stopLive = action(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (teamFlushTimer) {
    clearInterval(teamFlushTimer)
    teamFlushTimer = null
  }
  pendingLiveData = null
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  isLive.setFalse()
  liveKpis.set(null)
  liveTrend.set(null)
  liveCostTrend.set(null)
  liveInsights.set(null)
}, "overview.stopLive")

export const toggleLive = action(() => {
  if (isLive()) stopLive()
  else startLive()
}, "overview.toggleLive")
