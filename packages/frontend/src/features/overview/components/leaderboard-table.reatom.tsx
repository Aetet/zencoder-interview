/**
 * Reatom JSX table builder — returns real DOM elements.
 * Each row has one atom<Team>. Cell values are computed atoms.
 *
 * This .reatom.tsx file is transformed by the reatomJsx vite plugin
 * using classic JSX with h/hf from @reatom/jsx.
 */
import { h, hf } from '@reatom/jsx'
import { atom, computed, type Atom } from '@reatom/core'
import { formatCurrency, formatPercent, formatCurrencyPrecise } from '../../../shared/utils/format'
import { navigate } from '../../../routes'
import type { Team } from '@zendash/shared'

export const rowAtoms = new Map<string, Atom<Team>>()

export function getRowAtom(t: Team): Atom<Team> {
  const existing = rowAtoms.get(t.id)
  if (existing) {
    existing.set(t)
    return existing
  }
  const a = atom(t, `lb.row#${t.id}`)
  rowAtoms.set(t.id, a)
  return a
}

function TeamRow(team: Atom<Team>, rank: number) {
  // Computed atoms for each cell — reatom JSX auto-subscribes to these
  const name = computed(() => team().name, `lb.row#${team().id}.name`)
  const sessions = computed(() => team().sessions.toLocaleString(), `lb.row#${team().id}.sessions`)
  const cost = computed(() => formatCurrency(team().cost), `lb.row#${team().id}.cost`)
  const rate = computed(() => formatPercent(team().completionRate), `lb.row#${team().id}.rate`)
  const cps = computed(() => formatCurrencyPrecise(team().costPerSession), `lb.row#${team().id}.cps`)
  const rateClass = computed(() =>
    'py-2 px-4 text-[13px] tabular-nums live-value ' + (team().completionRate >= 0.85 ? 'text-success' : 'text-warning'),
    `lb.row#${team().id}.rateClass`,
  )

  return (
    <tr
      class={rank % 2 === 0
        ? 'border-b border-border cursor-pointer hover:bg-accent virtual-row bg-row-alt'
        : 'border-b border-border cursor-pointer hover:bg-accent virtual-row'
      }
      on:click={() => navigate(`/teams?detail=${team().id}`)}
    >
      <td class="py-2 px-4 text-[11px] text-foreground-muted tabular-nums">{String(rank)}</td>
      <td class="py-2 px-4 text-[13px] text-foreground font-medium truncate max-w-[160px]">{name}</td>
      <td class="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">{sessions}</td>
      <td class="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">{cost}</td>
      <td class={rateClass}>{rate}</td>
      <td class="py-2 px-4 text-[13px] text-foreground tabular-nums live-value">{cps}</td>
    </tr>
  )
}

const TH = 'text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4'

export function buildTable(teams: Team[]): HTMLElement {
  const rows = teams.map((t, i) => TeamRow(getRowAtom(t), i + 1))

  return (
    <div class="overflow-auto px-0 virtual-scroll">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-card z-10">
          <tr class="border-b border-border">
            <th class={`${TH} w-8`}>#</th>
            <th class={TH}>Team</th>
            <th class={TH}>Sessions</th>
            <th class={TH}>Cost</th>
            <th class={TH}>Rate</th>
            <th class={TH}>Cost/Sess</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  ) as unknown as HTMLElement
}
