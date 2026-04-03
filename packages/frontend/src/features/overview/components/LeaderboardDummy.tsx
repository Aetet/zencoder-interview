import { useState, useEffect, useRef } from 'react'
import { Card } from '../../../shared/components/Card'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatNumber } from '../../../shared/utils/format'
import { cn } from '../../../shared/utils/cn'
import { isLive } from '../model'
import { reatomComponent } from '@reatom/react'

interface DummyTeam {
  id: string
  name: string
  sessions: number
  cost: number
  completionRate: number
  costPerSession: number
}

function generateDummyTeams(count: number): DummyTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `dummy-${i}`,
    name: `Team ${i + 1}`,
    sessions: 100 + Math.floor(Math.random() * 900),
    cost: Math.round(Math.random() * 500 * 100) / 100,
    completionRate: 0.7 + Math.random() * 0.25,
    costPerSession: Math.round(Math.random() * 100) / 100,
  }))
}

function vary(v: number): number {
  return v * (1 + (Math.random() - 0.5) * 0.06)
}

// Pure React state — no reatom, no atoms. Just useState + setInterval.
function DummyGrid({ count, flushMs }: { count: number; flushMs: number }) {
  const [teams, setTeams] = useState<DummyTeam[]>(() => generateDummyTeams(count))
  const live = isLive()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!live) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTeams(prev =>
        prev.map(t => ({
          ...t,
          sessions: Math.round(vary(t.sessions)),
          cost: Math.round(vary(t.cost) * 100) / 100,
          completionRate: Math.min(1, Math.max(0, vary(t.completionRate))),
          costPerSession: Math.round(vary(t.costPerSession) * 100) / 100,
        }))
      )
    }, flushMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [live, flushMs])

  return (
    <Card className="flex flex-col p-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <h3 className="text-sm font-medium text-foreground-secondary">
          Dummy Leaderboard (React state, {flushMs}ms)
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
            {teams.map((t, i) => (
              <tr
                key={t.id}
                className={cn(
                  'border-b border-border transition-colors duration-150',
                  i % 2 === 0 && 'bg-row-alt',
                )}
              >
                <td className="py-2 px-4 text-[11px] text-foreground-muted tabular-nums">{i + 1}</td>
                <td className="py-2 px-4 text-[13px] text-foreground font-medium">{t.name}</td>
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
}

// Wrapper that reads isLive from reatom
export const LeaderboardDummy = reatomComponent(() => {
  return <DummyGrid count={1000} flushMs={300} />
}, 'LeaderboardDummy')
