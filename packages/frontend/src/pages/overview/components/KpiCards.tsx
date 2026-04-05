import { reatomComponent } from '@reatom/react'
import { overviewRoute } from '../overview-route'
import { KpiCard } from '../../../shared/components/KpiCard'
import { formatCurrency, formatNumber, formatPercent, formatCurrencyPrecise } from '../../../shared/utils/format'

export const KpiCards = reatomComponent(() => {
  const live = overviewRoute.isLive() || overviewRoute.isTurbo()

  return (
    <div className="grid grid-cols-5 gap-4">
      <KpiCard label="Total Sessions" value={formatNumber(overviewRoute.totalSessions())} delta="+12%" deltaType="positive" live={live} />
      <KpiCard label="Total Cost" value={formatCurrency(overviewRoute.totalCost())} delta="+8%" deltaType="neutral" live={live} />
      <KpiCard label="Active Users" value={`${overviewRoute.activeUsers()}/${overviewRoute.totalUsers()}`} delta={formatPercent(overviewRoute.adoptionRate()) + ' adoption'} live={live} />
      <KpiCard label="Completion Rate" value={formatPercent(overviewRoute.completionRate())} deltaType="positive" live={live} />
      <KpiCard label="Cost / Session" value={formatCurrencyPrecise(overviewRoute.costPerSession())} delta="↓ -5%" deltaType="positive" live={live} />
    </div>
  )
}, 'KpiCards')
