import { reatomComponent } from "@reatom/react"
import { overviewRoute } from "./overview-route"
import { Skeleton } from "../../shared/components/Skeleton"
import { KpiCards } from "./components/KpiCards"
import { InsightsPanel } from "./components/InsightsPanel"
import { TeamLeaderboard } from "./components/TeamLeaderboard"
import { TurboModeButton } from "./components/TurboModeButton"
import { CostChart } from "./components/CostChart"
import { SessionsChart } from "./components/SessionsChart"

export const OverviewPage = reatomComponent(() => {
  const ready = overviewRoute.loader.ready()
  const live = overviewRoute.isLive()
  const turbo = overviewRoute.isTurbo()

  if (!ready) {
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground-secondary">
          Overview
          {live && <span className="ml-3 text-xs text-success font-normal animate-pulse">LIVE</span>}
          {turbo && <span className="ml-3 text-xs text-warning font-normal animate-pulse">TURBO</span>}
        </h1>
        <TurboModeButton />
      </div>

      <KpiCards />

      <div className="grid grid-cols-2 gap-4">
        <SessionsChart />
        <CostChart />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InsightsPanel />
        <TeamLeaderboard />
      </div>
    </div>
  )
}, "OverviewPage")
