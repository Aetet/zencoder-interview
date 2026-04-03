import { reatomComponent } from '@reatom/react'
import {
  totalSessions, totalCost, activeUsers, totalUsers,
  adoptionRate, completionRate, costPerSession, isLive,
} from '../model'
import { KpiCard } from '../../../shared/components/KpiCard'
import { formatCurrency, formatNumber, formatPercent, formatCurrencyPrecise } from '../../../shared/utils/format'

export const KpiCards = reatomComponent(() => {
  const live = isLive()

  return (
    <div className="grid grid-cols-5 gap-4">
      <KpiCard
        label="Total Sessions"
        value={formatNumber(totalSessions())}
        delta="+12%"
        deltaType="positive"
        live={live}
      />
      <KpiCard
        label="Total Cost"
        value={formatCurrency(totalCost())}
        delta="+8%"
        deltaType="neutral"
        live={live}
      />
      <KpiCard
        label="Active Users"
        value={`${activeUsers()}/${totalUsers()}`}
        delta={formatPercent(adoptionRate()) + ' adoption'}
        live={live}
      />
      <KpiCard
        label="Completion Rate"
        value={formatPercent(completionRate())}
        deltaType="positive"
        live={live}
      />
      <KpiCard
        label="Cost / Session"
        value={formatCurrencyPrecise(costPerSession())}
        delta="↓ -5%"
        deltaType="positive"
        live={live}
      />
    </div>
  )
}, 'KpiCards')
