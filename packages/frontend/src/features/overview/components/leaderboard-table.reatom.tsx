/**
 * Reatom JSX table — subscribes to teamsAtom, renders reactively.
 * No manual DOM patching. reatom/jsx handles all updates.
 *
 * This .reatom.tsx file is transformed by the reatomJsx vite plugin.
 */
import { h, hf } from "@reatom/jsx"
import { computed } from "@reatom/core"
import { formatCurrency, formatPercent, formatCurrencyPrecise } from "../../../shared/utils/format"
import { navigate } from "../../../routes"
import { teamsAtom } from "../model"

const TH = "text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-left py-2.5 px-4"
const TD = "py-2 px-4 text-[13px] text-foreground tabular-nums live-value"
const RANK = "py-2 px-4 text-[11px] text-foreground-muted tabular-nums"
const NAME = "py-2 px-4 text-[13px] text-foreground font-medium truncate max-w-[160px]"

// Reactive row list — computed from teamsAtom, returns array of JSX elements
const rows = computed(() => {
  return teamsAtom().map((t, i) => {
    const rank = i + 1
    return (
      <tr
        class={
          rank % 2 === 0
            ? "border-b border-border cursor-pointer hover:bg-accent virtual-row bg-row-alt"
            : "border-b border-border cursor-pointer hover:bg-accent virtual-row"
        }
        on:click={() => navigate(`/teams?detail=${t.id}`)}
      >
        <td class={RANK}>{String(rank)}</td>
        <td class={NAME}>{t.name}</td>
        <td class={TD}>{t.sessions.toLocaleString()}</td>
        <td class={TD}>{formatCurrency(t.cost)}</td>
        <td class={`${TD} ${t.completionRate >= 0.85 ? "text-success" : "text-warning"}`}>
          {formatPercent(t.completionRate)}
        </td>
        <td class={TD}>{formatCurrencyPrecise(t.costPerSession)}</td>
      </tr>
    )
  })
}, "overview.teamRows")

export function TeamLeaderboardJsx(): HTMLElement {
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
