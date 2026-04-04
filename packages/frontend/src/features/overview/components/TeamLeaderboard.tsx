/**
 * TeamLeaderboard — React wrapper that mounts a reatom/jsx table.
 * The table is built in leaderboard-table.tsx using reatom JSX.
 * This file is pure React JSX.
 */
import { useRef, useEffect, useState } from 'react'
import { mount } from '@reatom/jsx'
import { Card } from '../../../shared/components/Card'
import { formatNumber } from '../../../shared/utils/format'
import { renderTeams, isLive, registerLivePatch } from '../model'
import { buildTable, rowAtoms } from './leaderboard-table.reatom'
import type { Team } from '@zendash/shared'

export function TeamLeaderboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const builtRef = useRef(false)
  const [header, setHeader] = useState({ count: 0, live: false })

  // Build reatom JSX table on initial data
  useEffect(() => {
    const unsub = renderTeams.subscribe((teams) => {
      if (!containerRef.current || teams.length === 0) return
      setHeader(h => ({ ...h, count: teams.length }))

      if (!builtRef.current) {
        const el = buildTable(teams)
        containerRef.current.textContent = ''
        // Use reatom's mount() to activate reactive subscriptions
        const { unmount } = mount(containerRef.current, el as any)
        builtRef.current = true
      } else {
        // Filter change — update all row atoms
        for (const t of teams) {
          const a = rowAtoms.get(t.id)
          if (a) a.set(t)
        }
      }
    })
    return unsub
  }, [])

  // Live badge
  useEffect(() => {
    const unsub = isLive.subscribe((live) => {
      setHeader(h => ({ ...h, live }))
    })
    return unsub
  }, [])

  // Live patch — set row atoms, reatom JSX handles DOM updates
  useEffect(() => {
    registerLivePatch((teams: Team[]) => {
      for (const t of teams) {
        const a = rowAtoms.get(t.id)
        if (a) a.set(t)
      }
    })
    return () => registerLivePatch(null)
  }, [])

  return (
    <Card className="flex flex-col p-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <h3 className="text-sm font-medium text-foreground-secondary">
          Team Leaderboard
          {header.live && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />}
        </h3>
        <span className="text-[11px] text-foreground-muted">{formatNumber(header.count)} teams</span>
      </div>
      <div ref={containerRef} />
    </Card>
  )
}
