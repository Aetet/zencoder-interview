import { reatomComponent } from '@reatom/react'
import { teamsRoute, teamRoute, editTeamRoute } from './teams-route'
import { settingsRoute } from '../settings/settings-route'
import { KpiCard } from '../../shared/components/KpiCard'
import { Card } from '../../shared/components/Card'
import { Skeleton } from '../../shared/components/Skeleton'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatTimeAgo } from '../../shared/utils/format'
import { cn } from '../../shared/utils/cn'
import { ModelUsageChart } from './components/ModelUsageChart'
import { CoinsIcon } from '../../shared/components/icons/CoinsIcon'

const MEMBER_COLS = '1fr 100px 80px 100px 100px 100px'
const CELL = 'py-2 px-3 text-[13px] text-foreground tabular-nums truncate text-right'
const HEADER_CELL = 'py-2.5 px-3 text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-right'

export const TeamPage = reatomComponent(() => {
  const teams = teamsRoute.teamsList()
  const selectedId = teamRoute.selectedTeamId()
  const users = teamRoute.teamUsers()
  const selectedTeam = teams.find(t => t.id === selectedId)

  if (!selectedTeam) {
    return <Skeleton className="h-96" />
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground-secondary">{selectedTeam.name}</h1>
        <TeamBudgetInline teamId={selectedTeam.id} cost={selectedTeam.cost} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Sessions" value={String(selectedTeam.sessions)} />
        <KpiCard label="Completion" value={formatPercent(selectedTeam.completionRate)} />
        <KpiCard label="Cost/Session" value={formatCurrencyPrecise(selectedTeam.costPerSession)} />
        <KpiCard label="Cache Hit" value={formatPercent(selectedTeam.cacheHitRate)} />
      </div>

      <Card className="flex flex-col p-0 overflow-hidden">
        <h3 className="text-sm font-medium text-foreground-secondary px-6 pt-6 pb-3">Team Members</h3>
        <div className="grid border-b border-border" style={{ gridTemplateColumns: MEMBER_COLS }}>
          <div className={cn(HEADER_CELL, 'text-left')}>User</div>
          <div className={HEADER_CELL}>Sessions</div>
          <div className={HEADER_CELL}>Cost</div>
          <div className={HEADER_CELL}>Completion</div>
          <div className={HEADER_CELL}>Cost/Session</div>
          <div className={HEADER_CELL}>Last Active</div>
        </div>
        <div className="overflow-auto max-h-[450px]">
          {users.map((u, i) => (
            <div
              key={u.id}
              className={cn('grid border-b border-border items-center', i % 2 === 0 && 'bg-row-alt')}
              style={{ gridTemplateColumns: MEMBER_COLS }}
            >
              <div className="py-2 px-4 text-[13px] text-accent-foreground truncate">{u.email}</div>
              <div className={CELL}>{u.sessions.toLocaleString()}</div>
              <div className={CELL}>{formatCurrency(u.cost)}</div>
              <div className={cn(CELL, u.completionRate >= 0.85 ? 'text-success' : 'text-warning')}>
                {formatPercent(u.completionRate)}
              </div>
              <div className={CELL}>{formatCurrencyPrecise(u.costPerSession)}</div>
              <div className="py-2 px-4 text-[13px] text-foreground-muted truncate text-right">
                {formatTimeAgo(u.lastActive)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <ModelUsageChart />
    </>
  )
}, 'TeamPage')

const TeamBudgetInline = reatomComponent(({ teamId, cost }: { teamId: string; cost: number }) => {
  const budgets = settingsRoute.computedTeamBudgets()
  const budget = budgets[teamId] ?? 0

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm tabular-nums text-foreground">
        {formatCurrencyPrecise(cost)}
        <span className="text-foreground-muted"> / {formatCurrency(budget)}</span>
      </span>
      <button
        onClick={() => editTeamRoute.open()}
        className="text-foreground-muted hover:text-accent-foreground transition-colors cursor-pointer"
        title="Edit budget"
      >
        <CoinsIcon size={16} />
      </button>
    </div>
  )
}, 'TeamBudgetInline')
