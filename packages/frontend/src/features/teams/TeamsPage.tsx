import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { reatomComponent } from '@reatom/react'
import { teamsRoute } from './teams-model'
import { KpiCard } from '../../shared/components/KpiCard'
import { Card } from '../../shared/components/Card'
import { DataTable } from '../../shared/components/DataTable'
import { Skeleton } from '../../shared/components/Skeleton'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatTimeAgo } from '../../shared/utils/format'
import { cn } from '../../shared/utils/cn'
import type { Team, TeamUser } from '@zendash/shared'
import { ModelUsageChart } from './components/ModelUsageChart'

const VISIBLE_TABS = 10

export const TeamsPage = reatomComponent(() => {
  const ready = teamsRoute.loader.ready()
  const teams = teamsRoute.teamsList()
  const selectedId = teamsRoute.selectedTeamId()
  const users = teamsRoute.teamUsers()

  if (!ready && teams.length === 0) {
    return <Skeleton className="h-96" />
  }

  const selectedTeam = teams.find((t) => t.id === selectedId)

  return (
    <div className="flex flex-col gap-5 h-full">
      <h1 className="text-xl font-medium text-foreground-secondary">Teams</h1>

      <TeamTabs teams={teams} selectedId={selectedId} />

      {!selectedId ? (
        <AllTeamsGrid teams={teams} />
      ) : selectedTeam ? (
        <div className="space-y-5">
          <div className="grid grid-cols-5 gap-4">
            <KpiCard label="Sessions" value={String(selectedTeam.sessions)} />
            <KpiCard label="Cost" value={formatCurrency(selectedTeam.cost)} />
            <KpiCard label="Completion" value={formatPercent(selectedTeam.completionRate)} />
            <KpiCard label="Cost/Session" value={formatCurrencyPrecise(selectedTeam.costPerSession)} />
            <KpiCard label="Cache Hit" value={formatPercent(selectedTeam.cacheHitRate)} />
          </div>

          <Card className="flex flex-col p-0 overflow-hidden">
            <h3 className="text-sm font-medium text-foreground-secondary px-6 pt-6 pb-3">Team Members</h3>
            <div className="grid border-b border-border" style={{ gridTemplateColumns: MEMBER_COLS }}>
              <div className={HEADER_CELL}>User</div>
              <div className={HEADER_CELL}>Sessions</div>
              <div className={HEADER_CELL}>Cost</div>
              <div className={HEADER_CELL}>Completion</div>
              <div className={HEADER_CELL}>Cost/Session</div>
              <div className={HEADER_CELL}>Last Active</div>
            </div>
            <div className="overflow-auto h-[400px]">
              {users.map((u, i) => (
                <div
                  key={u.id}
                  className={cn('grid border-b border-border items-center', i % 2 === 0 && 'bg-row-alt')}
                  style={{ gridTemplateColumns: MEMBER_COLS }}
                >
                  <div className="py-2 px-4 text-[13px] text-accent-foreground truncate">{u.email}</div>
                  <div className={CELL}>{u.sessions.toLocaleString()}</div>
                  <div className={CELL}>{formatCurrency(u.cost)}</div>
                  <div className={cn(CELL, u.completionRate >= 0.85 ? 'text-success' : 'text-warning')}>{formatPercent(u.completionRate)}</div>
                  <div className={CELL}>{formatCurrencyPrecise(u.costPerSession)}</div>
                  <div className="py-2 px-4 text-[13px] text-foreground-muted truncate">{formatTimeAgo(u.lastActive)}</div>
                </div>
              ))}
            </div>
          </Card>

          <ModelUsageChart />
        </div>
      ) : null}
    </div>
  )
}, 'TeamsPage')

const ROW_HEIGHT = 37
const GRID_COLS = '1fr 100px 80px 100px 100px 80px'
const MEMBER_COLS = '1fr 100px 80px 100px 100px 100px'
const CELL = 'py-2 px-4 text-[13px] text-foreground tabular-nums truncate'
const HEADER_CELL = 'py-2.5 px-4 text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted'

function AllTeamsGrid({ teams }: { teams: Team[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: teams.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <Card className="flex flex-col p-0 overflow-hidden flex-1 min-h-0">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: GRID_COLS }}>
        <div className={HEADER_CELL}>Team</div>
        <div className={HEADER_CELL}>Sessions</div>
        <div className={HEADER_CELL}>Cost</div>
        <div className={HEADER_CELL}>Completion</div>
        <div className={HEADER_CELL}>Cost/Session</div>
        <div className={HEADER_CELL}>Cache Hit</div>
      </div>

      <div ref={scrollRef} className="overflow-auto flex-1">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const t = teams[virtualRow.index]
            return (
              <div
                key={t.id}
                className={cn(
                  'grid border-b border-border cursor-pointer hover:bg-accent items-center',
                  virtualRow.index % 2 === 0 && 'bg-row-alt',
                )}
                style={{
                  gridTemplateColumns: GRID_COLS,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => teamsRoute.selectTeam(t.id)}
              >
                <div className="py-2 px-4 text-[13px] text-foreground font-medium truncate">{t.name}</div>
                <div className={CELL}>{t.sessions.toLocaleString()}</div>
                <div className={CELL}>{formatCurrency(t.cost)}</div>
                <div className={cn(CELL, t.completionRate >= 0.85 ? 'text-success' : 'text-warning')}>
                  {formatPercent(t.completionRate)}
                </div>
                <div className={CELL}>{formatCurrencyPrecise(t.costPerSession)}</div>
                <div className={cn(CELL, t.cacheHitRate < 0.3 ? 'text-error' : t.cacheHitRate < 0.5 ? 'text-warning' : '')}>
                  {formatPercent(t.cacheHitRate)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function TeamTabs({ teams, selectedId }: { teams: Team[]; selectedId: string | null }) {
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? teams : teams.slice(0, VISIBLE_TABS)
  const remaining = teams.length - VISIBLE_TABS

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button
        onClick={() => teamsRoute.selectTeam(null)}
        className={cn(
          'px-3 py-1.5 rounded-xl text-[13px] transition-colors cursor-pointer',
          !selectedId ? 'bg-accent text-foreground font-medium' : 'text-foreground-muted hover:text-foreground',
        )}
      >
        All Teams
      </button>
      {visible.map((t) => (
        <button
          key={t.id}
          onClick={() => teamsRoute.selectTeam(t.id)}
          className={cn(
            'px-3 py-1.5 rounded-xl text-[13px] transition-colors cursor-pointer',
            selectedId === t.id ? 'bg-accent text-foreground font-medium' : 'text-foreground-muted hover:text-foreground',
          )}
        >
          {t.name}
        </button>
      ))}
      {remaining > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="px-3 py-1.5 text-[13px] text-accent-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {showAll ? 'Show less' : `+${remaining} more`}
        </button>
      )}
    </div>
  )
}
