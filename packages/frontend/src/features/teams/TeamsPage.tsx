import { reatomComponent } from '@reatom/react'
import { useEffect } from 'react'
import { teamsList, selectedTeamId, teamUsers, teamsLoading, fetchTeams, selectTeam } from './model'
import { filterParams } from '../../shared/filters/model'
import { KpiCard } from '../../shared/components/KpiCard'
import { Card } from '../../shared/components/Card'
import { DataTable } from '../../shared/components/DataTable'
import { Skeleton } from '../../shared/components/Skeleton'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatTimeAgo } from '../../shared/utils/format'
import { cn } from '../../shared/utils/cn'
import type { Team, TeamUser } from '@zendash/shared'
import { ModelUsageChart } from './components/ModelUsageChart'

export const TeamsPage = reatomComponent(() => {
  const params = filterParams()
  const loading = teamsLoading()
  const teams = teamsList()
  const selectedId = selectedTeamId()
  const users = teamUsers()

  useEffect(() => {
    fetchTeams()
  }, [JSON.stringify(params)])

  if (loading && teams.length === 0) {
    return <Skeleton className="h-96" />
  }

  const selectedTeam = teams.find((t) => t.id === selectedId)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium text-foreground-secondary">Teams</h1>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => selectTeam(null)}
          className={cn(
            'px-3 py-1.5 rounded-xl text-[13px] transition-colors',
            !selectedId ? 'bg-accent text-foreground font-medium' : 'text-foreground-muted hover:text-foreground',
          )}
        >
          All Teams
        </button>
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTeam(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-[13px] transition-colors',
              selectedId === t.id ? 'bg-accent text-foreground font-medium' : 'text-foreground-muted hover:text-foreground',
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      {!selectedId ? (
        <Card>
          <DataTable
            columns={[
              { key: 'name', header: 'Team', render: (t: Team) => <span className="font-medium">{t.name}</span> },
              { key: 'sessions', header: 'Sessions', render: (t: Team) => String(t.sessions) },
              { key: 'cost', header: 'Cost', render: (t: Team) => formatCurrency(t.cost) },
              { key: 'rate', header: 'Completion', render: (t: Team) => <span className={t.completionRate >= 0.85 ? 'text-success' : 'text-warning'}>{formatPercent(t.completionRate)}</span> },
              { key: 'cps', header: 'Cost/Session', render: (t: Team) => formatCurrencyPrecise(t.costPerSession) },
              { key: 'cache', header: 'Cache Hit', render: (t: Team) => <span className={t.cacheHitRate < 0.3 ? 'text-error' : t.cacheHitRate < 0.5 ? 'text-warning' : ''}>{formatPercent(t.cacheHitRate)}</span> },
            ]}
            data={teams}
            onRowClick={(t) => selectTeam(t.id)}
          />
        </Card>
      ) : selectedTeam ? (
        <div className="space-y-5">
          <div className="grid grid-cols-5 gap-4">
            <KpiCard label="Sessions" value={String(selectedTeam.sessions)} />
            <KpiCard label="Cost" value={formatCurrency(selectedTeam.cost)} />
            <KpiCard label="Completion" value={formatPercent(selectedTeam.completionRate)} />
            <KpiCard label="Cost/Session" value={formatCurrencyPrecise(selectedTeam.costPerSession)} />
            <KpiCard label="Cache Hit" value={formatPercent(selectedTeam.cacheHitRate)} />
          </div>

          <Card>
            <h3 className="text-sm font-medium text-foreground-secondary mb-4">Team Members</h3>
            <DataTable
              columns={[
                { key: 'email', header: 'User', render: (u: TeamUser) => <span className="text-accent-foreground">{u.email}</span> },
                { key: 'sessions', header: 'Sessions', render: (u: TeamUser) => String(u.sessions) },
                { key: 'cost', header: 'Cost', render: (u: TeamUser) => formatCurrency(u.cost) },
                { key: 'rate', header: 'Completion', render: (u: TeamUser) => formatPercent(u.completionRate) },
                { key: 'cps', header: 'Cost/Session', render: (u: TeamUser) => formatCurrencyPrecise(u.costPerSession) },
                { key: 'active', header: 'Last Active', render: (u: TeamUser) => <span className="text-foreground-muted">{formatTimeAgo(u.lastActive)}</span> },
              ]}
              data={users}
            />
          </Card>

          <ModelUsageChart />
        </div>
      ) : null}
    </div>
  )
}, 'TeamsPage')
