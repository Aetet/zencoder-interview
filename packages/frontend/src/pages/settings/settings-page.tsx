import { reatomComponent } from '@reatom/react'
import { settingsRoute } from './settings-route'
import { costsRoute } from '../costs/costs-route'
import { teamRoute } from '../teams/teams-route'
import { Card } from '../../shared/components/Card'
import { Skeleton } from '../../shared/components/Skeleton'
import { formatCurrency, formatTimeAgo } from '../../shared/utils/format'
import { cn } from '../../shared/utils/cn'

const THRESHOLD_LEVELS = [50, 75, 90, 100]

export const SettingsPage = reatomComponent(() => {
  const ready = settingsRoute.loader.ready()

  if (!ready) return <Skeleton className="h-96" />

  // Sync server config into atoms on first render
  settingsRoute.initFromServer()

  return (
    <div className="flex flex-col gap-5 h-full">
      <h1 className="text-xl font-medium text-foreground-secondary">Notifications & Alerts</h1>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="flex flex-col overflow-auto">
          <h3 className="text-sm font-medium text-foreground-secondary mb-4">Alert Thresholds</h3>
          <p className="text-xs text-foreground-muted mb-3">
            Get notified when org spend reaches these percentages of the monthly budget.
          </p>
          <AlertThresholds />

          <h3 className="text-sm font-medium text-foreground-secondary mt-8 mb-4">Alert Delivery</h3>
          <div className="space-y-2">
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

          <h3 className="text-sm font-medium text-foreground-secondary mt-8 mb-4">Anomaly Detection</h3>
          <label className="flex items-center justify-between py-1.5">
            <span className="text-sm text-foreground">Enabled</span>
            <div className="w-9 h-5 rounded-full bg-primary relative">
              <div className="w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] right-[3px]" />
            </div>
          </label>
          <div className="text-xs text-foreground-muted mt-1">
            Alerts when daily spend exceeds 2x the rolling average
          </div>
        </Card>

        <Card className="flex flex-col overflow-auto">
          <h3 className="text-sm font-medium text-foreground-secondary mb-4">Alert History</h3>
          <AlertHistory />
        </Card>
      </div>
    </div>
  )
}, 'SettingsPage')

const AlertThresholds = reatomComponent(() => {
  const budgetValue = settingsRoute.budgetInput()
  const thresholdsState = settingsRoute.thresholds()

  return (
    <div className="space-y-2">
      {THRESHOLD_LEVELS.map((level) => {
        const active = thresholdsState[level] ?? false
        return (
          <label key={level} className="flex items-center justify-between py-1.5 cursor-pointer">
            <span className="text-sm text-foreground">
              {level}% — Notify at {formatCurrency(Number(budgetValue) * level / 100)}
            </span>
            <button
              type="button"
              onClick={() => settingsRoute.thresholds.set((s) => ({ ...s, [level]: !s[level] }))}
              className={cn('w-9 h-5 rounded-full transition-colors relative', active ? 'bg-primary' : 'bg-accent')}
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
  )
}, 'AlertThresholds')

const AlertHistory = reatomComponent(() => {
  const alerts = settingsRoute.alertHistory()

  if (alerts.length === 0) {
    return <p className="text-sm text-foreground-muted">No alerts yet.</p>
  }

  return (
    <div className="space-y-2 flex-1">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex gap-3 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-2 -mx-2 transition-colors"
          onClick={() => {
            if (alert.teamId) {
              teamRoute.go({ teamId: alert.teamId })
            } else {
              costsRoute.go({})
            }
          }}
        >
          <div className={cn(
            'w-2.5 h-2.5 rounded-full mt-1 shrink-0',
            alert.severity === 'error' ? 'bg-error' : alert.severity === 'warning' ? 'bg-warning' : 'bg-accent-foreground',
          )} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-foreground-muted">{formatTimeAgo(alert.timestamp)}</div>
            <div className="text-[13px] text-foreground font-medium mt-0.5">{alert.title}</div>
            <div className="text-xs text-foreground-muted mt-0.5 truncate">{alert.description}</div>
          </div>
          <span className="text-[11px] text-accent-foreground self-center shrink-0">
            {alert.teamId ? `→ ${alert.teamId}` : '→ costs'}
          </span>
        </div>
      ))}
    </div>
  )
}, 'AlertHistory')
