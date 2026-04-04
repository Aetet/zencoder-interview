import { useState, useEffect } from 'react'
import { Card } from '../../../shared/components/Card'
import { formatNumber } from '../../../shared/utils/format'
import { r } from '../../../shared/utils/reatom-jsx-in-react'
import { teamsAtom, isLive } from '../model'
import { TeamLeaderboardJsx } from './leaderboard-table.reatom'

const LeaderboardTable = r(TeamLeaderboardJsx, 'LeaderboardTable')

export function TeamLeaderboard() {
  const [header, setHeader] = useState({ count: 0, live: false })

  useEffect(() => {
    const u1 = teamsAtom.subscribe((teams) => setHeader(h => ({ ...h, count: teams.length })))
    const u2 = isLive.subscribe((live) => setHeader(h => ({ ...h, live })))
    return () => { u1(); u2() }
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
      <LeaderboardTable />
    </Card>
  )
}
