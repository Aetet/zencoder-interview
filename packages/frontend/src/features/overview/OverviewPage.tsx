import { reatomFactoryComponent } from "@reatom/react"
import { effect } from "@reatom/core"
import { overviewResource, isLive, stopLive } from "./model"
import { Skeleton } from "../../shared/components/Skeleton"
import { KpiCards } from "./components/KpiCards"
import { SessionsChart } from "./components/SessionsChart"
import { CostChart } from "./components/CostChart"
import { InsightsPanel } from "./components/InsightsPanel"
import { TeamLeaderboard } from "./components/TeamLeaderboard"
import { GoLiveButton } from "./components/GoLiveButton"

export const OverviewPage = reatomFactoryComponent(() => {
  // Factory runs once per mount.
  // Effect auto-cleans on unmount — stops SSE when navigating away.
  effect(() => {
    // Cleanup: stop live mode when this component unmounts
    return () => {
      if (isLive()) stopLive()
    }
  }, "overview.cleanupEffect")

  // Render function — runs on every atom change
  return () => {
    // Subscribe to the async computed to trigger the fetch
    overviewResource()
    const ready = overviewResource.ready()
    const data = overviewResource.data()
    const live = isLive()

    if (!ready && !data) {
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      )
    }

    if (!data) return null

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-foreground-secondary">
            Overview
            {live && <span className="ml-3 text-xs text-error font-normal animate-pulse">LIVE</span>}
          </h1>
          <GoLiveButton />
        </div>

        <KpiCards />

        <div className={live ? "grid grid-cols-2 gap-4 live-chart" : "grid grid-cols-2 gap-4"}>
          {/* <SessionsChart /> */}
          {/* <CostChart /> */}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InsightsPanel />
          <TeamLeaderboard />
        </div>
      </div>
    )
  }
}, "OverviewPage")
