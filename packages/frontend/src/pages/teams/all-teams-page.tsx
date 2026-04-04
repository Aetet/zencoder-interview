import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { reatomComponent } from "@reatom/react"
import { teamsRoute, teamRoute, editBudgetRoute, editAllTeamRoute } from "./teams-route"
import { settingsRoute } from "../settings/settings-route"
import { CoinsIcon } from "../../shared/components/icons/CoinsIcon"
import { Modal } from "../../shared/components/Modal"
import { Input } from "../../shared/components/Input"
import { Card } from "../../shared/components/Card"
import { formatCurrency, formatPercent, formatCurrencyPrecise } from "../../shared/utils/format"
import { cn } from "../../shared/utils/cn"
import type { Team } from "@zendash/shared"

// ---------------------------------------------------------------------------
// Grid constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 38
const GRID_COLS = "minmax(100px, 1fr) 80px 90px 110px 85px 75px"
const CELL = "py-2 px-3 text-[13px] text-foreground tabular-nums truncate text-right"
const HEADER_CELL = "py-2.5 px-3 text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted text-right"

// ---------------------------------------------------------------------------
// All Teams page — /teams (exact)
// ---------------------------------------------------------------------------

export const AllTeamsContent = reatomComponent(() => {
  const teams = teamsRoute.teamsList()

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground-secondary">All Teams</h1>
        <OrgBudgetInline />
      </div>
      <AllTeamsGrid teams={teams} />
      <EditOrgBudgetModal />
    </>
  )
}, "AllTeamsContent")

const EditOrgBudgetModal = reatomComponent(() => {
  const open = editBudgetRoute.isOpen()
  if (!open) return null

  return (
    <Modal open onClose={() => editBudgetRoute.close()} title="Edit Org Budget">
      <form
        onSubmit={e => {
          e.preventDefault()
          editBudgetRoute.save()
        }}
      >
        <label className="text-xs text-foreground-muted">
          Monthly Budget (USD)
        </label>
        <div className="mt-2">
          <EditOrgBudgetInput />
        </div>
        <OrgBudgetValidation />
        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => editBudgetRoute.close()}
            className="flex-1 bg-accent text-foreground py-2 rounded-xl text-sm font-medium hover:bg-accent/80 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}, 'EditOrgBudgetModal')

const OrgBudgetValidation = reatomComponent(() => {
  const v = editBudgetRoute.validation()
  if (!v) return null
  if (v.error) return <div className="text-xs mt-2 text-error">{v.error}</div>
  if (v.warning) return <div className="text-xs mt-2 text-warning">{v.warning}</div>
  return null
}, 'OrgBudgetValidation')

const EditOrgBudgetInput = reatomComponent(() => {
  return (
    <Input
      type="number"
      value={editBudgetRoute.editingValue()}
      onChange={v => editBudgetRoute.editingValue.set(v)}
      autoFocus
    />
  )
}, 'EditOrgBudgetInput')

const OrgBudgetInline = reatomComponent(() => {
  const teams = teamsRoute.teamsList()
  const totalSpend = teams.reduce((sum, t) => sum + t.cost, 0)
  const budget = Number(settingsRoute.budgetInput()) || 0

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm tabular-nums text-foreground">
        {formatCurrencyPrecise(totalSpend)}
        <span className="text-foreground-muted"> / {formatCurrency(budget)}</span>
      </span>
      <button
        onClick={() => editBudgetRoute.open()}
        className="text-foreground-muted hover:text-accent-foreground transition-colors cursor-pointer"
        title="Edit org budget"
      >
        <CoinsIcon size={16} />
      </button>
    </div>
  )
}, 'OrgBudgetInline')

// ---------------------------------------------------------------------------
// All Teams virtualized grid
// ---------------------------------------------------------------------------

const AllTeamsGrid = reatomComponent(({ teams }: { teams: Team[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const budgets = settingsRoute.computedTeamBudgets()

  const virtualizer = useVirtualizer({
    count: teams.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <Card className="flex flex-col p-0 overflow-hidden flex-1 min-h-0">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: GRID_COLS }}>
        <div className={cn(HEADER_CELL, "text-left")}>Team</div>
        <div className={HEADER_CELL}>Sessions</div>
        <div className={HEADER_CELL}>Completion</div>
        <div className={HEADER_CELL}>Spent / Budget</div>
        <div className={HEADER_CELL}>Cost/Sess</div>
        <div className={HEADER_CELL}>Cache</div>
      </div>

      <div ref={scrollRef} className="overflow-y-auto overflow-x-hidden flex-1">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const t = teams[virtualRow.index]
            return <TeamGridRow key={t.id} team={t} teamBudget={budgets[t.id] ?? 1} index={virtualRow.index} start={virtualRow.start} />
          })}
        </div>
      </div>
    </Card>
  )
}, 'AllTeamsGrid')

function TeamGridRow({ team, teamBudget, index, start }: { team: Team; teamBudget: number; index: number; start: number }) {

  return (
    <div
      className={cn(
        "grid border-b border-border cursor-pointer hover:bg-accent items-center",
        index % 2 === 0 && "bg-row-alt",
      )}
      style={{
        gridTemplateColumns: GRID_COLS,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: ROW_HEIGHT,
        transform: `translateY(${start}px)`,
      }}
      onClick={() => editAllTeamRoute.open(team.id)}
    >
      <div className="py-2 px-4 text-[13px] text-foreground font-medium truncate">
        <span
          className="hover:text-accent-foreground hover:underline cursor-pointer"
          onClick={(e) => { e.stopPropagation(); teamRoute.go({ teamId: team.id }) }}
        >
          {team.name}
        </span>
      </div>
      <div className={CELL}>{team.sessions.toLocaleString()}</div>
      <div className={cn(CELL, team.completionRate >= 0.85 ? "text-success" : "text-warning")}>
        {formatPercent(team.completionRate)}
      </div>
      <div className="py-2 px-3 text-[13px] tabular-nums truncate text-right">
        <span className="text-foreground">{formatCurrency(team.cost)}</span>
        <span className="text-foreground-muted"> / {formatCurrency(teamBudget)}</span>
      </div>
      <div className={CELL}>{formatCurrencyPrecise(team.costPerSession)}</div>
      <div className={cn(CELL, team.cacheHitRate < 0.3 ? "text-error" : team.cacheHitRate < 0.5 ? "text-warning" : "")}>
        {formatPercent(team.cacheHitRate)}
      </div>
    </div>
  )
}
