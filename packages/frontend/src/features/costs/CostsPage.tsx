import { reatomComponent } from '@reatom/react'
import { useEffect } from 'react'
import { costBreakdown, cacheData, budgetData, topFiles, costsLoading, fetchCosts } from './model'
import { filterParams } from '../../shared/filters/model'
import { KpiCard } from '../../shared/components/KpiCard'
import { Skeleton } from '../../shared/components/Skeleton'
import { formatCurrency, formatCompact } from '../../shared/utils/format'
import { TokenBreakdownChart } from './components/TokenBreakdownChart'
import { CacheEfficiencyPanel } from './components/CacheEfficiencyPanel'
import { BudgetTracker } from './components/BudgetTracker'
import { TopFilesTable } from './components/TopFilesTable'

export const CostsPage = reatomComponent(() => {
  const params = filterParams()
  const loading = costsLoading()
  const breakdown = costBreakdown()

  useEffect(() => {
    fetchCosts()
  }, [JSON.stringify(params)])

  if (loading && !breakdown) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!breakdown) return null

  const cache = cacheData()
  const budget = budgetData()
  const files = topFiles()

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium text-foreground-secondary">Cost & Usage</h1>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Spend" value={formatCurrency(breakdown.total)} />
        <KpiCard label="Input Tokens" value={formatCompact(breakdown.byTokenType.input * 1_000_000 / 3)} delta={formatCurrency(breakdown.byTokenType.input)} />
        <KpiCard label="Output Tokens" value={formatCompact(breakdown.byTokenType.output * 1_000_000 / 15)} delta={formatCurrency(breakdown.byTokenType.output)} />
        <KpiCard
          label="Cache Reads"
          value={cache ? formatCurrency(breakdown.byTokenType.cacheRead) : '$0'}
          delta={cache ? `Saved ${formatCurrency(cache.savings)}` : undefined}
          deltaType="positive"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TokenBreakdownChart data={breakdown.tokenTrend} />
        {cache && <CacheEfficiencyPanel data={cache} />}
      </div>

      {budget && <BudgetTracker data={budget} />}

      {files && <TopFilesTable data={files} />}
    </div>
  )
}, 'CostsPage')
