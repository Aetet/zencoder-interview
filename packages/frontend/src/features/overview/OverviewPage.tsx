import { reatomComponent } from '@reatom/react'
import { useEffect } from 'react'
import { overviewSummary, overviewInsights, overviewTeams, overviewLoading, fetchOverview, stopLive, isLive } from './model'
import { filterParams } from '../../shared/filters/model'
import { KpiCard } from '../../shared/components/KpiCard'
import { Skeleton } from '../../shared/components/Skeleton'
import { formatCurrency, formatNumber, formatPercent, formatCurrencyPrecise } from '../../shared/utils/format'
import { SessionsChart } from './components/SessionsChart'
import { CostChart } from './components/CostChart'
import { InsightsPanel } from './components/InsightsPanel'
import { TeamLeaderboard } from './components/TeamLeaderboard'
import { GoLiveButton } from './components/GoLiveButton'

export const OverviewPage = reatomComponent(() => {
  const params = filterParams()
  const loading = overviewLoading()
  const summary = overviewSummary()
  const live = isLive()

  useEffect(() => {
    fetchOverview()
    return () => {
      if (isLive()) stopLive()
    }
  }, [JSON.stringify(params)])

  if (loading && !summary) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground-secondary">
          Overview
          {live && <span className="ml-3 text-xs text-error font-normal animate-pulse">LIVE</span>}
        </h1>
        <GoLiveButton />
      </div>

      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Total Sessions" value={formatNumber(summary.totalSessions)} delta="+12%" deltaType="positive" live={live} />
        <KpiCard label="Total Cost" value={formatCurrency(summary.totalCost)} delta="+8%" deltaType="neutral" live={live} />
        <KpiCard label="Active Users" value={`${summary.activeUsers}/${summary.totalUsers}`} delta={formatPercent(summary.adoptionRate) + ' adoption'} live={live} />
        <KpiCard label="Completion Rate" value={formatPercent(summary.completionRate)} deltaType="positive" live={live} />
        <KpiCard label="Cost / Session" value={formatCurrencyPrecise(summary.costPerSession)} delta="↓ -5%" deltaType="positive" live={live} />
      </div>

      <div className={live ? 'grid grid-cols-2 gap-4 live-chart' : 'grid grid-cols-2 gap-4'}>
        <SessionsChart data={summary.trend} live={live} />
        <CostChart data={summary.costTrend} live={live} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InsightsPanel insights={overviewInsights()} live={live} />
        <TeamLeaderboard teams={overviewTeams()} live={live} />
      </div>
    </div>
  )
}, 'OverviewPage')
