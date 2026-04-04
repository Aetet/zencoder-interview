import { useRef, useEffect, useState } from 'react'
import { Card } from '../../../shared/components/Card'
import { formatCurrency, formatPercent, formatCurrencyPrecise, formatNumber } from '../../../shared/utils/format'
import { navigate } from '../../../routes'
import { renderTeams, isLive, registerLivePatch } from '../model'
import type { Team } from '@zendash/shared'

const TH_CLASS = 'text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4'

function patchRow(tr: HTMLTableRowElement, t: Team) {
  const c = tr.children
  ;(c[2] as HTMLElement).textContent = t.sessions.toLocaleString()
  ;(c[3] as HTMLElement).textContent = formatCurrency(t.cost)
  const c4 = c[4] as HTMLElement
  c4.textContent = formatPercent(t.completionRate)
  if (t.completionRate >= 0.85) { c4.classList.add('text-success'); c4.classList.remove('text-warning') }
  else { c4.classList.add('text-warning'); c4.classList.remove('text-success') }
  ;(c[5] as HTMLElement).textContent = formatCurrencyPrecise(t.costPerSession)
}

function buildRow(t: Team, rank: number): HTMLTableRowElement {
  const tr = document.createElement('tr')
  tr.className = rank % 2 === 0
    ? 'border-b border-border cursor-pointer hover:bg-accent virtual-row bg-row-alt'
    : 'border-b border-border cursor-pointer hover:bg-accent virtual-row'
  tr.onclick = () => navigate(`/teams?detail=${t.id}`)
  tr.innerHTML = `
    <td class="py-2 px-4 text-[11px] text-foreground-muted tabular-nums">${rank}</td>
    <td class="py-2 px-4 text-[13px] text-foreground font-medium truncate max-w-[160px]">${t.name}</td>
    <td class="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">${t.sessions.toLocaleString()}</td>
    <td class="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">${formatCurrency(t.cost)}</td>
    <td class="py-2 px-4 text-[13px] tabular-nums live-value ${t.completionRate >= 0.85 ? 'text-success' : 'text-warning'}">${formatPercent(t.completionRate)}</td>
    <td class="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">${formatCurrencyPrecise(t.costPerSession)}</td>
  `
  return tr
}

// Plain React component — no reatom wrapper. Manual subscriptions only.
export function TeamLeaderboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null)
  const [header, setHeader] = useState({ count: 0, live: false })

  // Subscribe to renderTeams — build table on data arrival
  useEffect(() => {
    const unsub = renderTeams.subscribe((teams) => {
      if (!containerRef.current || teams.length === 0) return

      setHeader(h => ({ ...h, count: teams.length }))

      if (!tbodyRef.current) {
        // Build entire table
        const table = document.createElement('table')
        table.className = 'w-full text-sm'
        table.innerHTML = `
          <thead class="sticky top-0 bg-card z-10">
            <tr class="border-b border-border">
              <th class="${TH_CLASS} w-8">#</th>
              <th class="${TH_CLASS}">Team</th>
              <th class="${TH_CLASS}">Sessions</th>
              <th class="${TH_CLASS}">Cost</th>
              <th class="${TH_CLASS}">Rate</th>
              <th class="${TH_CLASS}">Cost/Sess</th>
            </tr>
          </thead>
        `
        const tbody = document.createElement('tbody')
        const frag = document.createDocumentFragment()
        for (let i = 0; i < teams.length; i++) {
          frag.appendChild(buildRow(teams[i], i + 1))
        }
        tbody.appendChild(frag)
        table.appendChild(tbody)
        containerRef.current.textContent = ''
        containerRef.current.appendChild(table)
        tbodyRef.current = tbody
      } else {
        // Patch existing rows
        const rows = tbodyRef.current.children
        for (let i = 0; i < Math.min(teams.length, rows.length); i++) {
          patchRow(rows[i] as HTMLTableRowElement, teams[i])
        }
      }
    })
    return unsub
  }, [])

  // Subscribe to isLive for header
  useEffect(() => {
    const unsub = isLive.subscribe((live) => {
      setHeader(h => ({ ...h, live }))
    })
    return unsub
  }, [])

  // Register live patch — direct DOM updates, no React
  useEffect(() => {
    registerLivePatch((teams: Team[]) => {
      if (!tbodyRef.current) return
      const rows = tbodyRef.current.children
      for (let i = 0; i < Math.min(teams.length, rows.length); i++) {
        patchRow(rows[i] as HTMLTableRowElement, teams[i])
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
      <div ref={containerRef} className="overflow-auto px-0 virtual-scroll" />
    </Card>
  )
}
