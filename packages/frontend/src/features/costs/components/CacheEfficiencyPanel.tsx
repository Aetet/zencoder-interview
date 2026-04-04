import { useState } from 'react'
import { Card } from '../../../shared/components/Card'
import { formatPercent, formatCurrency } from '../../../shared/utils/format'
import { cn } from '../../../shared/utils/cn'
import type { CacheData } from '@zendash/shared'

const VISIBLE_COUNT = 5

export function CacheEfficiencyPanel({ data }: { data: CacheData }) {
  const sorted = [...data.byTeam].sort((a, b) => a.rate - b.rate)
  const [expanded, setExpanded] = useState(false)

  const top = sorted.slice(0, VISIBLE_COUNT)
  const rest = sorted.slice(VISIBLE_COUNT)

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

      <div className="space-y-2">
        {top.map((team) => (
          <TeamBar key={team.teamId} team={team} />
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-xs text-accent-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className={cn(
              'inline-block transition-transform duration-200',
              expanded ? 'rotate-90' : 'rotate-0',
            )}>
              ▸
            </span>
            {expanded ? 'Show less' : `and ${rest.length} more teams...`}
          </button>

          <div className={cn('fold-enter', expanded && 'fold-open')}>
            <div className="fold-inner">
              <div className="mt-2 ml-4 pl-3 border-l-2 border-border space-y-2">
                {rest.map((team) => (
                  <TeamBar key={team.teamId} team={team} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

function TeamBar({ team }: { team: { teamId: string; teamName: string; rate: number } }) {
  return (
    <div className="flex items-center gap-3">
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
