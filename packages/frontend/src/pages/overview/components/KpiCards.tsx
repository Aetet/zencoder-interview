import { reatomComponent } from '@reatom/react'
import { overviewRoute } from '../overview-route'
import { KpiCard } from '../../../shared/components/KpiCard'
import { formatCurrency, formatNumber, formatPercent, formatCurrencyPrecise } from '../../../shared/utils/format'

export const KpiCards = reatomComponent(() => {
  const live = overviewRoute.isLive() || overviewRoute.isTurbo()
  const v = overviewRoute.view()

  return (
    <div className="grid grid-cols-5 gap-4">
      <KpiCard label="Total Sessions" value={formatNumber(v.totalSessions)} delta="+12%" deltaType="positive" live={live} />
      <KpiCard label="Total Cost" value={formatCurrency(v.totalCost)} delta="+8%" deltaType="neutral" live={live} />
      <KpiCard label="Active Users" value={`${v.activeUsers}/${v.totalUsers}`} delta={formatPercent(v.adoptionRate) + ' adoption'} live={live} />
      <KpiCard label="Completion Rate" value={formatPercent(v.completionRate)} deltaType="positive" live={live} />
      <KpiCard label="Cost / Session" value={formatCurrencyPrecise(v.costPerSession)} delta="↓ -5%" deltaType="positive" live={live} />
    </div>
  )
}, 'KpiCards')
