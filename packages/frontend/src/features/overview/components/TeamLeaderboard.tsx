import { Card } from '../../../shared/components/Card'
import { formatCurrency, formatPercent, formatCurrencyPrecise } from '../../../shared/utils/format'
import { navigate } from '../../../routes'
import { cn } from '../../../shared/utils/cn'
import type { Team } from '@zendash/shared'

export function TeamLeaderboard({ teams, live }: { teams: Team[]; live?: boolean }) {
  const sorted = [...teams].sort((a, b) => b.cost - a.cost).slice(0, 5)

  return (
    <Card>
      <h3 className="text-sm font-medium text-foreground-secondary mb-4">
        Team Leaderboard
        {live && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-3 px-4">Team</th>
            <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-3 px-4">Sessions</th>
            <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-3 px-4">Cost</th>
            <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-3 px-4">Rate</th>
            <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-3 px-4">Cost/Sess</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr
              key={t.id}
              className={cn(
                'border-b border-border cursor-pointer hover:bg-accent transition-colors duration-150',
                i % 2 === 1 && 'bg-row-alt',
              )}
              onClick={() => navigate(`/teams?detail=${t.id}`)}
            >
              <td className="py-3 px-4 text-[13px] text-foreground font-medium">{t.name}</td>
              <td className={cn('py-3 px-4 text-[13px] text-foreground tabular-nums', live && 'live-value')}>
                {t.sessions.toLocaleString()}
              </td>
              <td className={cn('py-3 px-4 text-[13px] text-foreground tabular-nums', live && 'live-value')}>
                {formatCurrency(t.cost)}
              </td>
              <td className={cn('py-3 px-4 text-[13px] tabular-nums', t.completionRate >= 0.85 ? 'text-success' : 'text-warning', live && 'live-value')}>
                {formatPercent(t.completionRate)}
              </td>
              <td className={cn('py-3 px-4 text-[13px] text-foreground tabular-nums', live && 'live-value')}>
                {formatCurrencyPrecise(t.costPerSession)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
