/**
 * TeamLeaderboard — React wrapper that mounts a reatom/jsx table.
 */
import { useRef, useEffect, useState } from 'react'
import { mount } from '@reatom/jsx'
import { Card } from '../../../shared/components/Card'
import { formatNumber } from '../../../shared/utils/format'
import { teamsAtom, isLive } from '../model'
import { buildLeaderboard } from './leaderboard-table.reatom'

export function TeamLeaderboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef<{ unmount: () => void } | null>(null)
  const [header, setHeader] = useState({ count: 0, live: false })

  useEffect(() => {
    if (!containerRef.current) return

    // Build reatom JSX element and mount it — activates reactive subscriptions
    const el = buildLeaderboard()
    const handle = mount(containerRef.current, el as any)
    mountedRef.current = handle

    return () => {
      handle.unmount()
      mountedRef.current = null
    }
  }, [])

  // Track header state
  useEffect(() => {
    const unsub = teamsAtom.subscribe((teams) => {
      setHeader(h => ({ ...h, count: teams.length }))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = isLive.subscribe((live) => {
      setHeader(h => ({ ...h, live }))
    })
    return unsub
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
