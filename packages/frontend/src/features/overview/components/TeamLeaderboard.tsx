import { reatomComponent } from '@reatom/react'
import { Card } from '../../../shared/components/Card'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatNumber } from '../../../shared/utils/format'
import { navigate } from '../../../routes'
import { cn } from '../../../shared/utils/cn'
import { sortedTeamModels, isLive, type TeamModel } from '../model'

// Atomized row — only re-renders when THIS team's atoms change
const TeamRow = reatomComponent(({ model, rank }: { model: TeamModel; rank: number }) => {
  const live = isLive()
  const name = model.name()
  const sessions = model.sessions()
  const cost = model.cost()
  const rate = model.completionRate()
  const cps = model.costPerSession()

  return (
    <tr
      className={cn(
        'border-b border-border cursor-pointer hover:bg-accent transition-colors duration-150',
        rank % 2 === 0 && 'bg-row-alt',
      )}
      onClick={() => navigate(`/teams?detail=${model.id}`)}
    >
      <td className="py-2 px-4 text-[11px] text-foreground-muted tabular-nums">{rank}</td>
      <td className="py-2 px-4 text-[13px] text-foreground font-medium truncate max-w-[160px]">{name}</td>
      <td className={cn('py-2 px-4 text-[13px] text-foreground tabular-nums', live && 'live-value')}>
        {sessions.toLocaleString()}
      </td>
      <td className={cn('py-2 px-4 text-[13px] text-foreground tabular-nums', live && 'live-value')}>
        {formatCurrency(cost)}
      </td>
      <td className={cn('py-2 px-4 text-[13px] tabular-nums', rate >= 0.85 ? 'text-success' : 'text-warning', live && 'live-value')}>
        {formatPercent(rate)}
      </td>
      <td className={cn('py-2 px-4 text-[13px] text-foreground tabular-nums', live && 'live-value')}>
        {formatCurrencyPrecise(cps)}
      </td>
    </tr>
  )
}, 'TeamRow')

export const TeamLeaderboard = reatomComponent(() => {
  const teams = sortedTeamModels()
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

      <div className="overflow-auto max-h-[480px] px-0">
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
            {teams.map((model, i) => (
              <TeamRow key={model.id} model={model} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}, 'TeamLeaderboard')
