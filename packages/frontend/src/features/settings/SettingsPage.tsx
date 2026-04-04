import { reatomComponent } from "@reatom/react"
import { settingsRoute } from "./settings-model"
import { teamsRoute } from "../teams/teams-model"
import { costsRoute } from "../costs/costs-model"
import { Card } from "../../shared/components/Card"
import { CollapsibleList } from "../../shared/components/CollapsibleList"
import { Input } from "../../shared/components/Input"
import { Modal } from "../../shared/components/Modal"
import { ProgressBar } from "../../shared/components/ProgressBar"
import { Skeleton } from "../../shared/components/Skeleton"
import { formatCurrency } from "../../shared/utils/format"
import { cn } from "../../shared/utils/cn"
import type { TeamBudget } from "@zendash/shared"

const THRESHOLD_LEVELS = [50, 75, 90, 100]

export const SettingsPage = reatomComponent(() => {
  const ready = settingsRoute.loader.ready()
  const budget = settingsRoute.budget()

  if (!ready) return <Skeleton className="h-96" />

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium text-foreground-secondary">Settings</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              settingsRoute.saveBudget()
            }}
          >
            <h3 className="text-sm font-medium text-foreground-secondary mb-4">Organization Budget</h3>

            <label className="block text-xs text-foreground-muted mb-1">Monthly Budget (USD)</label>
            <BudgetInput />
            {budget && (
              <div className="text-xs text-foreground-muted mt-1">
                Current spend: {formatCurrency(budget.currentSpend)} ({Math.round(budget.percentUsed * 100)}%)
              </div>
            )}

            <h4 className="text-sm font-medium text-foreground-secondary mt-6 mb-3">Alert Thresholds</h4>
            <AlertThresholds />

            {budget && (
              <>
                <h4 className="text-sm font-medium text-foreground-secondary mt-6 mb-3">Team Budgets</h4>
                <TeamBudgetsList teamBudgets={budget.teamBudgets} />
              </>
            )}

            <SaveButton />
          </form>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-foreground-secondary mb-4">Notifications</h3>

          <h4 className="text-xs text-foreground-muted uppercase tracking-wider mb-3">Alert Delivery</h4>
          <div className="space-y-2 mb-6">
            {["Email notifications", "In-app notifications"].map(label => (
              <label key={label} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground">{label}</span>
                <div className="w-9 h-5 rounded-full bg-primary relative">
                  <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] right-[3px]" />
                </div>
              </label>
            ))}
            <label className="flex items-center justify-between py-1.5 opacity-50">
              <span className="text-sm text-foreground">
                Slack integration
                <span className="ml-2 text-[10px] bg-accent text-foreground-muted px-1.5 py-0.5 rounded">
                  Coming soon
                </span>
              </span>
              <div className="w-9 h-5 rounded-full bg-accent relative">
                <div className="w-3.5 h-3.5 rounded-full bg-foreground-muted absolute top-[3px] left-[3px]" />
              </div>
            </label>
          </div>

          <h4 className="text-xs text-foreground-muted uppercase tracking-wider mb-3">Recent Alerts</h4>
          <div className="space-y-3">
            {[
              {
                date: "Apr 2",
                text: "Frontend exceeded budget ($1,456 / $1,200)",
                type: "error" as const,
                team: "frontend",
              },
              {
                date: "Apr 1",
                text: "Org reached 50% threshold ($3,000 / $6,000)",
                type: "warning" as const,
                team: null,
              },
              { date: "Mar 28", text: "Backend spend spike (+340% daily avg)", type: "info" as const, team: "backend" },
            ].map((alert, i) => (
              <div
                key={i}
                className="flex gap-3 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                onClick={() => {
                  if (alert.team) {
                    teamsRoute.go({})
                    // Select team after navigation
                    setTimeout(() => teamsRoute.selectTeam(alert.team), 100)
                  } else {
                    costsRoute.go({})
                  }
                }}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                    alert.type === "error"
                      ? "bg-error"
                      : alert.type === "warning"
                      ? "bg-warning"
                      : "bg-accent-foreground",
                  )}
                />
                <div className="flex-1">
                  <div className="text-xs text-foreground-muted">{alert.date}</div>
                  <div className="text-[13px] text-foreground">{alert.text}</div>
                </div>
                <span className="text-[11px] text-accent-foreground self-center shrink-0">
                  {alert.team ? `→ ${alert.team}` : "→ costs"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <EditTeamBudgetModal />
    </div>
  )
}, "SettingsPage")

// Isolated — only re-renders when budgetInput changes
const BudgetInput = reatomComponent(() => {
  return <Input type="number" value={settingsRoute.budgetInput()} onChange={(v) => settingsRoute.budgetInput.set(v)} />
}, 'BudgetInput')

// Isolated — only re-renders when saving changes
const SaveButton = reatomComponent(() => {
  const isSaving = settingsRoute.saving()
  return (
    <button
      type="submit"
      disabled={isSaving}
      className="w-full mt-6 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
    >
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  )
}, 'SaveButton')

// Isolated — re-renders when budgetInput or thresholds change, not the whole page
const AlertThresholds = reatomComponent(() => {
  const budgetValue = settingsRoute.budgetInput()
  const thresholdsState = settingsRoute.thresholds()

  return (
    <div className="space-y-2">
      {THRESHOLD_LEVELS.map(level => {
        const active = thresholdsState[level] ?? false
        return (
          <label key={level} className="flex items-center justify-between py-1.5 cursor-pointer">
            <span className="text-sm text-foreground">
              {level}% — Notify at {formatCurrency((Number(budgetValue) * level) / 100)}
            </span>
            <button
              type="button"
              onClick={() => settingsRoute.thresholds.set(s => ({ ...s, [level]: !s[level] }))}
              className={cn("w-9 h-5 rounded-full transition-colors relative", active ? "bg-primary" : "bg-accent")}
            >
              <div
                className={cn(
                  "w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all",
                  active ? "right-[3px] bg-white" : "left-[3px] bg-foreground-muted",
                )}
              />
            </button>
          </label>
        )
      })}
    </div>
  )
}, "AlertThresholds")

const VISIBLE_TEAMS = 5

// Reads expand state from route atom — survives parent re-renders
const TeamBudgetsList = reatomComponent(({ teamBudgets }: { teamBudgets: TeamBudget[] }) => {
  const expanded = settingsRoute.teamBudgetsExpanded()
  const top = teamBudgets.slice(0, VISIBLE_TEAMS)
  const rest = teamBudgets.slice(VISIBLE_TEAMS)

  return (
    <>
      {top.map((tb) => <TeamBudgetRow key={tb.teamId} tb={tb} />)}

      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => settingsRoute.teamBudgetsExpanded.toggle()}
            className="mt-2 text-xs text-accent-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className={cn('inline-block transition-transform duration-200', expanded ? 'rotate-90' : 'rotate-0')}>
              ▸
            </span>
            {expanded ? 'Show less' : `and ${rest.length} more teams...`}
          </button>

          <div className={cn('fold-enter', expanded && 'fold-open')}>
            <div className="fold-inner">
              <div className="mt-2 ml-4 pl-3 border-l-2 border-border">
                {rest.map((tb) => <TeamBudgetRow key={tb.teamId} tb={tb} />)}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}, 'TeamBudgetsList')

// Clickable row — opens edit modal
const TeamBudgetRow = reatomComponent(({ tb }: { tb: TeamBudget }) => {
  const customBudget = settingsRoute.teamBudgets()[tb.teamId] ?? 1
  const pct = customBudget > 0 ? tb.spent / customBudget : 0
  return (
    <div
      className="py-1.5 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2 transition-colors"
      onClick={() => settingsRoute.openEditTeam(tb.teamId)}
    >
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground">{tb.teamName}</span>
        <span className="text-foreground">
          {formatCurrency(tb.spent)} / {formatCurrency(customBudget)}
          {pct > 1 && <span className="text-error ml-1">Over</span>}
          <span className="text-accent-foreground ml-2">✎</span>
        </span>
      </div>
      <ProgressBar value={pct} color={pct > 1 ? "bg-error" : pct > 0.75 ? "bg-warning" : "bg-success"} height="h-1.5" />
    </div>
  )
}, "TeamBudgetRow")

// Modal for editing team budget
const EditTeamBudgetModal = reatomComponent(() => {
  const params = settingsRoute.editTeamModal()
  const teamId = params?.editTeam
  if (!teamId) return null

  const budget = settingsRoute.budget()
  const teamName = budget?.teamBudgets.find(t => t.teamId === teamId)?.teamName ?? teamId

  return (
    <Modal open onClose={() => settingsRoute.closeEditTeam()} title={`Edit Budget — ${teamName}`}>
      <form
        onSubmit={e => {
          e.preventDefault()
          settingsRoute.saveTeamBudget()
        }}
      >
        <label className="block text-xs text-foreground-muted mb-1">Monthly Budget (USD)</label>
        <EditTeamInput />
        <div className="flex gap-3 mt-4">
          <button
            type="submit"
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => settingsRoute.closeEditTeam()}
            className="flex-1 bg-accent text-foreground py-2 rounded-xl text-sm font-medium hover:bg-accent/80 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}, "EditTeamBudgetModal")

// Isolated input for modal
const EditTeamInput = reatomComponent(() => {
  return (
    <Input
      type="number"
      value={settingsRoute.editingTeamValue()}
      onChange={v => settingsRoute.editingTeamValue.set(v)}
      autoFocus
    />
  )
}, "EditTeamInput")
