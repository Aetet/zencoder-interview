import { reatomComponent } from '@reatom/react'
import { Card } from '../../../shared/components/Card'
import { cn } from '../../../shared/utils/cn'
import { overviewRoute } from '../overview-route'

const borderColors: Record<string, string> = {
  highCostTeam: 'border-l-primary',
  lowCacheRate: 'border-l-error',
  expensiveSession: 'border-l-warning',
}

export const InsightsPanel = reatomComponent(() => {
  const { insights } = overviewRoute.view()
  const turbo = overviewRoute.isTurbo()
  const active = overviewRoute.isLive() || turbo

  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground-secondary mb-4">
        Insights
        {active && <span className={cn("ml-2 inline-block w-1.5 h-1.5 rounded-full animate-pulse", turbo ? "bg-warning" : "bg-success")} />}
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={`${insight.type}-${i}`}
            className={cn(
              'border-l-4 pl-4 py-2 transition-all duration-200',
              borderColors[insight.type] ?? 'border-l-accent',
            )}
          >
            <div className={cn('text-[13px] text-foreground font-medium', active && 'live-value')}>
              {insight.title}
            </div>
            <div className="text-[11px] text-foreground-muted mt-0.5">{insight.description}</div>
            <a href={insight.link} className="text-[11px] text-accent-foreground mt-1 inline-block">
              View →
            </a>
          </div>
        ))}
      </div>
    </Card>
  )
}, 'InsightsPanel')
