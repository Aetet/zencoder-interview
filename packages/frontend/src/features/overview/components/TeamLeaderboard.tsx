import { reatomComponent } from '@reatom/react'
import { Card } from '../../../shared/components/Card'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatNumber } from '../../../shared/utils/format'
import { navigate } from '../../../routes'
import { cn } from '../../../shared/utils/cn'
import { teamsAtom, isLive } from '../model'

export const TeamLeaderboard = reatomComponent(() => {
  const teams = teamsAtom()
  const live = isLive()

  return (
    <Card className="flex flex-col p-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <h3 className="text-sm font-medium text-foreground-secondary">
          Team Leaderboard
          {live && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
        </h3>
        <span className="text-[11px] text-foreground-muted">{formatNumber(teams.length)} teams</span>
      </div>

      <div className="overflow-auto max-h-[480px] px-0 virtual-scroll">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4 w-8">#</th>
              <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4">Team</th>
              <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4">Sessions</th>
              <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4">Cost</th>
              <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4">Rate</th>
              <th className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4">Cost/Sess</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr
                key={t.id}
                className={cn(
                  'border-b border-border cursor-pointer hover:bg-accent virtual-row',
                  i % 2 === 0 && 'bg-row-alt',
                )}
                onClick={() => navigate(`/teams?detail=${t.id}`)}
              >
                <td className="py-2 px-4 text-[11px] text-foreground-muted tabular-nums">{i + 1}</td>
                <td className="py-2 px-4 text-[13px] text-foreground font-medium truncate max-w-[160px]">{t.name}</td>
                <td className="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">
                  {t.sessions.toLocaleString()}
                </td>
                <td className="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">
                  {formatCurrency(t.cost)}
                </td>
                <td className={cn('py-2 px-4 text-[13px] tabular-nums live-value', t.completionRate >= 0.85 ? 'text-success' : 'text-warning')}>
                  {formatPercent(t.completionRate)}
                </td>
                <td className="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">
                  {formatCurrencyPrecise(t.costPerSession)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}, 'TeamLeaderboard')
