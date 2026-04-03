import { reatomComponent } from '@reatom/react'
import { useEffect } from 'react'
import { budgetState, budgetInput, thresholds, saving, settingsLoading, fetchSettings, saveBudget } from './model'
import { Card } from '../../shared/components/Card'
import { ProgressBar } from '../../shared/components/ProgressBar'
import { Skeleton } from '../../shared/components/Skeleton'
import { formatCurrency } from '../../shared/utils/format'
import { cn } from '../../shared/utils/cn'

const THRESHOLD_LEVELS = [50, 75, 90, 100]

export const SettingsPage = reatomComponent(() => {
  const loading = settingsLoading()
  const budget = budgetState()
  const isSaving = saving()

  useEffect(() => {
    fetchSettings()
  }, [])

  if (loading && !budget) return <Skeleton className="h-96" />

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-medium text-foreground-secondary">Settings</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-foreground-secondary mb-4">Organization Budget</h3>

          <label className="block text-xs text-foreground-muted mb-1">Monthly Budget (USD)</label>
          <input
            type="number"
            value={budgetInput()}
            onChange={(e) => budgetInput.set(e.target.value)}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {budget && (
            <div className="text-xs text-foreground-muted mt-1">
              Current spend: {formatCurrency(budget.currentSpend)} ({Math.round(budget.percentUsed * 100)}%)
            </div>
          )}

          <h4 className="text-sm font-medium text-foreground-secondary mt-6 mb-3">Alert Thresholds</h4>
          <div className="space-y-2">
            {THRESHOLD_LEVELS.map((level) => {
              const active = thresholds()[level] ?? false
              return (
                <label key={level} className="flex items-center justify-between py-1.5 cursor-pointer">
                  <span className="text-sm text-foreground">
                    {level}% — Notify at {formatCurrency(Number(budgetInput()) * level / 100)}
                  </span>
                  <button
                    type="button"
                    onClick={() => thresholds.set((s) => ({ ...s, [level]: !s[level] }))}
                    className={cn(
                      'w-9 h-5 rounded-full transition-colors relative',
                      active ? 'bg-primary' : 'bg-accent',
                    )}
                  >
                    <div className={cn(
                      'w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all',
                      active ? 'right-[3px] bg-white' : 'left-[3px] bg-foreground-muted',
                    )} />
                  </button>
                </label>
              )
            })}
          </div>

          {budget && (
            <>
              <h4 className="text-sm font-medium text-foreground-secondary mt-6 mb-3">Team Budgets</h4>
              <div className="space-y-3">
                {budget.teamBudgets.map((tb) => {
                  const pct = tb.budget > 0 ? tb.spent / tb.budget : 0
                  return (
                    <div key={tb.teamId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground-muted">{tb.teamName}</span>
                        <span className="text-foreground">
                          {formatCurrency(tb.spent)} / {formatCurrency(tb.budget)}
                          {pct > 1 && <span className="text-error ml-1">Over</span>}
                        </span>
                      </div>
                      <ProgressBar
                        value={pct}
                        color={pct > 1 ? 'bg-error' : pct > 0.75 ? 'bg-warning' : 'bg-success'}
                        height="h-1.5"
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <button
            onClick={() => saveBudget()}
            disabled={isSaving}
            className="w-full mt-6 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-foreground-secondary mb-4">Notifications</h3>

          <h4 className="text-xs text-foreground-muted uppercase tracking-wider mb-3">Alert Delivery</h4>
          <div className="space-y-2 mb-6">
            {['Email notifications', 'In-app notifications'].map((label) => (
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
                <span className="ml-2 text-[10px] bg-accent text-foreground-muted px-1.5 py-0.5 rounded">Coming soon</span>
              </span>
              <div className="w-9 h-5 rounded-full bg-accent relative">
                <div className="w-3.5 h-3.5 rounded-full bg-foreground-muted absolute top-[3px] left-[3px]" />
              </div>
            </label>
          </div>

          <h4 className="text-xs text-foreground-muted uppercase tracking-wider mb-3">Recent Alerts</h4>
          <div className="space-y-3">
            {[
              { date: 'Apr 2', text: 'Frontend exceeded budget ($1,456 / $1,200)', type: 'error' as const },
              { date: 'Apr 1', text: 'Org reached 50% threshold ($3,000 / $6,000)', type: 'warning' as const },
              { date: 'Mar 28', text: 'Backend spend spike (+340% daily avg)', type: 'info' as const },
            ].map((alert, i) => (
              <div key={i} className="flex gap-3">
                <div className={cn(
                  'w-2 h-2 rounded-full mt-1.5 shrink-0',
                  alert.type === 'error' ? 'bg-error' : alert.type === 'warning' ? 'bg-warning' : 'bg-accent-foreground',
                )} />
                <div>
                  <div className="text-xs text-foreground-muted">{alert.date}</div>
                  <div className="text-[13px] text-foreground">{alert.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}, 'SettingsPage')
