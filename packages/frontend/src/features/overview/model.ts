import { atom, computed, action, effect, reatomBoolean, withAsyncData, wrap, type Atom } from '@reatom/core'
import { api } from '../../shared/api/client'
import { filterParams } from '../../shared/filters/model'
import type {
  Insight, QualityTier1, Team,
  LiveUpdate, DailySessionTrend, DailyCostTrend,
} from '@zendash/shared'

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
}, 'overview.resource').extend(withAsyncData({ initState: null }))

// ---------------------------------------------------------------------------
// 2. Live override atoms — SSE writes here, never into overviewResource
// ---------------------------------------------------------------------------

export const isLive = reatomBoolean(false, 'overview.isLive')

const liveKpis = atom<{
  totalSessions: number
  totalCost: number
  completionRate: number
  activeUsers: number
  costPerSession: number
} | null>(null, 'overview.liveKpis')

const liveTrend = atom<DailySessionTrend[] | null>(null, 'overview.liveTrend')
const liveCostTrend = atom<DailyCostTrend[] | null>(null, 'overview.liveCostTrend')
const liveInsights = atom<Insight[] | null>(null, 'overview.liveInsights')

// ---------------------------------------------------------------------------
// 3. Public computed atoms — pick live data if live, else resource data
// ---------------------------------------------------------------------------

const summaryData = computed(
  () => overviewResource.data()?.summary ?? null,
  'overview.summaryData',
)

export const totalSessions = computed(() => {
  const lk = liveKpis()
  return lk ? lk.totalSessions : (summaryData()?.totalSessions ?? 0)
}, 'overview.totalSessions')

export const totalCost = computed(() => {
  const lk = liveKpis()
  return lk ? lk.totalCost : (summaryData()?.totalCost ?? 0)
}, 'overview.totalCost')

export const completionRate = computed(() => {
  const lk = liveKpis()
  return lk ? lk.completionRate : (summaryData()?.completionRate ?? 0)
}, 'overview.completionRate')

export const activeUsers = computed(() => {
  const lk = liveKpis()
  return lk ? lk.activeUsers : (summaryData()?.activeUsers ?? 0)
}, 'overview.activeUsers')

export const totalUsers = computed(
  () => summaryData()?.totalUsers ?? 0,
  'overview.totalUsers',
)

export const adoptionRate = computed(
  () => summaryData()?.adoptionRate ?? 0,
  'overview.adoptionRate',
)

export const costPerSession = computed(() => {
  const lk = liveKpis()
  return lk ? lk.costPerSession : (summaryData()?.costPerSession ?? 0)
}, 'overview.costPerSession')

export const sessionTrend = computed(() => {
  return liveTrend() ?? summaryData()?.trend ?? []
}, 'overview.sessionTrend')

export const costTrend = computed(() => {
  return liveCostTrend() ?? summaryData()?.costTrend ?? []
}, 'overview.costTrend')

export const insightsList = computed(() => {
  return liveInsights() ?? overviewResource.data()?.insights ?? []
}, 'overview.insights')

export const qualityData = computed(
  () => overviewResource.data()?.quality ?? null,
  'overview.quality',
)

// ---------------------------------------------------------------------------
// 4. Atomized teams
// ---------------------------------------------------------------------------

export interface TeamModel {
  id: string
  name: Atom<string>
  sessions: Atom<number>
  cost: Atom<number>
  completionRate: Atom<number>
  costPerSession: Atom<number>
  cacheHitRate: Atom<number>
}

const teamModelsCache = new Map<string, TeamModel>()

function getOrCreateTeamModel(t: Team): TeamModel {
  const existing = teamModelsCache.get(t.id)
  if (existing) return existing

  const model: TeamModel = {
    id: t.id,
    name: atom(t.name, `overview.team#${t.id}.name`),
    sessions: atom(t.sessions, `overview.team#${t.id}.sessions`),
    cost: atom(t.cost, `overview.team#${t.id}.cost`),
    completionRate: atom(t.completionRate, `overview.team#${t.id}.completionRate`),
    costPerSession: atom(t.costPerSession, `overview.team#${t.id}.costPerSession`),
    cacheHitRate: atom(t.cacheHitRate, `overview.team#${t.id}.cacheHitRate`),
  }
  teamModelsCache.set(t.id, model)
  return model
}

function updateTeamModel(model: TeamModel, t: Team) {
  model.sessions.set(t.sessions)
  model.cost.set(t.cost)
  model.completionRate.set(t.completionRate)
  model.costPerSession.set(t.costPerSession)
  model.cacheHitRate.set(t.cacheHitRate)
}

export const teamModelsList = atom<TeamModel[]>([], 'overview.teamModels')

// Sync teams from resource when it loads
effect(() => {
  const raw = overviewResource.data()?.teams
  if (!raw) return
  const current = teamModelsList()
  let listChanged = current.length !== raw.length

  for (const t of raw) {
    const model = getOrCreateTeamModel(t)
    updateTeamModel(model, t)
    if (!listChanged && !current.some(m => m.id === t.id)) listChanged = true
  }

  if (listChanged) {
    teamModelsList.set(raw.map(t => getOrCreateTeamModel(t)))
  }
}, 'overview.syncTeamsEffect')

export const sortedTeamModels = computed(() => {
  const models = teamModelsList()
  return [...models].sort((a, b) => b.cost() - a.cost())
}, 'overview.sortedTeamModels')

// ---------------------------------------------------------------------------
// 5. Live mode — SSE with rAF throttle
//    Writes to live* atoms and team atoms in-place. Never touches overviewResource.
// ---------------------------------------------------------------------------

let eventSource: EventSource | null = null
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

  // Write to live override atoms — these are separate from overviewResource
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

  // Update team atoms in-place
  if (data.teams) {
    for (const t of data.teams) {
      const model = teamModelsCache.get(t.id)
      if (model) updateTeamModel(model, t)
    }
  }
}

export const startLive = action(() => {
  stopLive()
  const params = new URLSearchParams(filterParams())
  eventSource = new EventSource(`/api/overview/live?${params}`)

  eventSource.addEventListener('update', (event) => {
    try {
      pendingLiveData = JSON.parse(event.data)
      if (rafId === null) {
        rafId = requestAnimationFrame(applyLiveUpdate)
      }
    } catch { /* ignore */ }
  })

  eventSource.onerror = () => {
    stopLive()
    isLive.setFalse()
  }

  isLive.setTrue()
}, 'overview.startLive')

export const stopLive = action(() => {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  pendingLiveData = null
  if (eventSource) { eventSource.close(); eventSource = null }
  isLive.setFalse()
  // Clear live overrides so computed atoms fall back to resource data
  liveKpis.set(null)
  liveTrend.set(null)
  liveCostTrend.set(null)
  liveInsights.set(null)
}, 'overview.stopLive')

export const toggleLive = action(() => {
  if (isLive()) stopLive()
  else startLive()
}, 'overview.toggleLive')
