import { Card } from '../../../shared/components/Card'
import { CollapsibleList } from '../../../shared/components/CollapsibleList'
import { formatPercent, formatCurrency } from '../../../shared/utils/format'
import { cn } from '../../../shared/utils/cn'
import type { CacheData } from '@zendash/shared'

function TeamBar({ team }: { team: { teamId: string; teamName: string; rate: number } }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-foreground-muted w-20 shrink-0">{team.teamName}</span>
      <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            team.rate >= 0.5 ? 'bg-success' : team.rate >= 0.3 ? 'bg-warning' : 'bg-error',
          )}
          style={{ width: `${team.rate * 100}%` }}
        />
      </div>
      <span className="text-xs text-foreground w-10 text-right">{formatPercent(team.rate)}</span>
    </div>
  )
}

export function CacheEfficiencyPanel({ data }: { data: CacheData }) {
  const sorted = [...data.byTeam].sort((a, b) => a.rate - b.rate)

  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground-secondary mb-4">Cache Efficiency</h3>

      <div className="flex items-center gap-6 mb-6">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#232320" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="#218b30" strokeWidth="8"
              strokeDasharray={`${data.orgCacheHitRate * 264} 264`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-foreground">
            {Math.round(data.orgCacheHitRate * 100)}%
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-foreground-muted mb-1">Org Cache Hit Rate</div>
          <div className="text-sm text-success font-medium">
            Cache saved {formatCurrency(data.savings)} this period
          </div>
        </div>
      </div>

      <CollapsibleList
        items={sorted}
        visibleCount={5}
        keyFn={(t) => t.teamId}
        label="teams"
        renderItem={(team) => <TeamBar team={team} />}
      />
    </Card>
  )
}
