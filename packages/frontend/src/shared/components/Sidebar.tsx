import { reatomComponent } from '@reatom/react'
import { overviewRoute } from '../../pages/overview/overview-route'
import { costsRoute } from '../../pages/costs/costs-route'
import { teamsRoute } from '../../pages/teams/teams-route'
import { alertsRoute } from '../../pages/settings/alerts-route'
import { cn } from '../utils/cn'

const NAV_ITEMS = [
  { label: 'Overview', route: overviewRoute },
  { label: 'Costs', route: costsRoute },
  { label: 'Teams', route: teamsRoute },
  { label: 'Alerts', route: alertsRoute },
]

export const Sidebar = reatomComponent(() => {
  return (
    <aside className="w-[220px] min-h-screen bg-background-secondary flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="w-3.5 h-3.5 rounded bg-brand" />
        <span className="text-lg font-medium text-foreground">ZenDash</span>
      </div>

      <nav className="flex flex-col mt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.route.match()

          return (
            <button
              key={item.label}
              onClick={() => item.route.go({})}
              className={cn(
                'flex items-center h-10 px-10 text-sm text-left transition-colors cursor-pointer',
                isActive
                  ? 'bg-accent text-accent-foreground border-l-[3px] border-primary'
                  : 'text-foreground-muted hover:text-foreground hover:bg-accent/50 border-l-[3px] border-transparent',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto px-6 py-4 text-[11px] text-foreground-muted">
        Acme Corp
      </div>
    </aside>
  )
}, 'Sidebar')
