import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { reatomComponent } from '@reatom/react'
import { Card } from '../../../shared/components/Card'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatNumber } from '../../../shared/utils/format'
import { cn } from '../../../shared/utils/cn'
import { overviewRoute } from '../overview-route'
import { teamRoute } from '../../teams/teams-route'
import type { Team } from '@zendash/shared'

const ROW_HEIGHT = 37
const GRID_COLS = '50px 1fr 100px 80px 80px 90px'
const CELL = 'py-2 px-4 text-[13px] text-foreground tabular-nums truncate'
const HEADER_CELL = 'py-2.5 px-4 text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted'

// ---------------------------------------------------------------------------
// FlashCell
// ---------------------------------------------------------------------------

function FlashCell({ value, display, className }: { value: number; display: string; className?: string }) {
  const prevRef = useRef<number | undefined>(undefined)
  const prev = prevRef.current
  prevRef.current = value

  let flash = ''
  if (prev !== undefined) {
    if (value > prev) flash = 'flash-up'
    else if (value < prev) flash = 'flash-down'
  }

  return <div className={cn(CELL, className, flash)}>{display}</div>
}

// ---------------------------------------------------------------------------
// TeamRow
// ---------------------------------------------------------------------------

function TeamRow({ team, rank }: { team: Team; rank: number }) {
  return (
    <>
      <div className="py-2 px-4 text-[11px] text-foreground-muted tabular-nums">{rank}</div>
      <div className="py-2 px-4 text-[13px] text-foreground font-medium truncate">{team.name}</div>
      <FlashCell value={team.sessions} display={team.sessions.toLocaleString()} />
      <FlashCell value={team.cost} display={formatCurrency(team.cost)} />
      <FlashCell
        value={team.completionRate}
        display={formatPercent(team.completionRate)}
        className={team.completionRate >= 0.85 ? 'text-success' : 'text-warning'}
      />
      <FlashCell value={team.costPerSession} display={formatCurrencyPrecise(team.costPerSession)} />
    </>
  )
}

// ---------------------------------------------------------------------------
// TeamLeaderboard — virtualized grid
// ---------------------------------------------------------------------------

export const TeamLeaderboard = reatomComponent(() => {
  const teamsList = overviewRoute.teams()
  const live = overviewRoute.isLive()
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: teamsList.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <Card className="flex flex-col p-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <h3 className="text-sm font-medium text-foreground-secondary">
          Team Leaderboard
          {live && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
        </h3>
        <span className="text-[11px] text-foreground-muted">{formatNumber(teamsList.length)} teams</span>
      </div>

      {/* Header */}
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <div className={HEADER_CELL}>#</div>
        <div className={HEADER_CELL}>Team</div>
        <div className={HEADER_CELL}>Sessions</div>
        <div className={HEADER_CELL}>Cost</div>
        <div className={HEADER_CELL}>Rate</div>
        <div className={HEADER_CELL}>Cost/Sess</div>
      </div>

      {/* Virtualized rows */}
      <div ref={scrollRef} className="overflow-auto max-h-[444px]">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const t = teamsList[virtualRow.index]
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
                onClick={() => teamRoute.go({ teamId: t.id })}
              >
                <TeamRow team={t} rank={virtualRow.index + 1} />
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}, 'TeamLeaderboard')
