import { Card } from '../../../shared/components/Card'
import { ProgressBar } from '../../../shared/components/ProgressBar'
import { formatCurrency } from '../../../shared/utils/format'
import type { BudgetData } from '@zendash/shared'

export function BudgetTracker({ data }: { data: BudgetData }) {
  const markers = data.thresholds.map((t) => t / 100)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground-secondary">Budget Tracker</h3>
        <span className="text-xs text-foreground-muted">
          {formatCurrency(data.currentSpend)} / {formatCurrency(data.monthlyBudget)} ({Math.round(data.percentUsed * 100)}%)
        </span>
      </div>

      <ProgressBar
        value={data.percentUsed}
        color={data.percentUsed > 0.9 ? 'bg-error' : data.percentUsed > 0.75 ? 'bg-warning' : 'bg-primary'}
        markers={markers}
        height="h-3"
      />

      <div className="mt-2 text-xs text-accent-foreground">
        Projected: {formatCurrency(data.projected)} by month end
      </div>
    </Card>
  )
}
