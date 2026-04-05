import { action, computed, reatomRoute, wrap, withChangeHook } from "@reatom/core"
import { api } from "../../shared/api/client"
import { createLiveMode } from "../../shared/models/createLiveMode"
import type { LivePayload, OverviewView } from "./overview-types"

const EMPTY: OverviewView = {
  totalSessions: 0, totalCost: 0, completionRate: 0,
  activeUsers: 0, totalUsers: 0, adoptionRate: 0, costPerSession: 0,
  sessionTrend: [], costTrend: [], insights: [], teams: [], quality: null,
}

export const overviewRoute = reatomRoute({
  path: "overview",
  async loader() {
    const [summary, insights, teams, quality] = await Promise.all([
      wrap(api.sessions.summary({})),
      wrap(api.insights.list({})),
      wrap(api.teams.list({})),
      wrap(api.quality.tier1({})),
    ])
    return { summary, insights, teams, quality }
  },
}).extend(route => {
  // Real-time: polls DB every 5s
  const live = createLiveMode<LivePayload>({
    url: "/api/overview/live",
    name: "overview.live",
  })

  // Turbo: 15 updates/sec, no DB, for UI stress testing
  const turbo = createLiveMode<LivePayload>({
    url: "/api/turbo/live",
    name: "overview.turbo",
  })

  const isTurbo = turbo.isLive

  // Turbo data wins over live data
  const activeData = computed(() => turbo.data() ?? live.data(), "overview.activeData")

  const view = computed((): OverviewView => {
    const loaded = route.loader.data()
    const d = activeData()

    if (!loaded) return EMPTY

    return {
      totalSessions: d?.totalSessions ?? loaded.summary.totalSessions,
      totalCost: d?.totalCost ?? loaded.summary.totalCost,
      completionRate: d?.completionRate ?? loaded.summary.completionRate,
      activeUsers: d?.activeUsers ?? loaded.summary.activeUsers,
      costPerSession: d?.costPerSession ?? loaded.summary.costPerSession,
      sessionTrend: (d?.trend.length ? d.trend : null) ?? loaded.summary.trend,
      costTrend: (d?.costTrend.length ? d.costTrend : null) ?? loaded.summary.costTrend,
      insights: (d?.insights?.length ? d.insights : null) ?? loaded.insights,
      teams: d?.teams ?? loaded.teams,
      totalUsers: loaded.summary.totalUsers,
      adoptionRate: loaded.summary.adoptionRate,
      quality: loaded.quality,
    }
  }, "overview.view")

  const toggleTurbo = action(() => {
    if (isTurbo()) {
      turbo.stop()
      live.start()
    } else {
      live.stop()
      turbo.start()
    }
  }, "overview.toggleTurbo")

  // Auto-start live when entering, stop everything when leaving
  route.match.extend(
    withChangeHook(isMatch => {
      if (isMatch) live.start()
      if (!isMatch) { live.stop(); turbo.stop() }
    }),
  )

  return { view, isLive: live.isLive, isTurbo, toggleTurbo }
})
