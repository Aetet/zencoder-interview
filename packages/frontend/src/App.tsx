import { reatomComponent } from '@reatom/react'
import { currentPath } from './routes'
import { DashboardLayout } from './shared/components/DashboardLayout'
import { OverviewPage } from './features/overview/OverviewPage'
import { CostsPage } from './features/costs/CostsPage'
import { TeamsPage } from './features/teams/TeamsPage'
import { SettingsPage } from './features/settings/SettingsPage'

export const App = reatomComponent(() => {
  const path = currentPath()

  let page: React.ReactNode
  if (path === '/' || path === '') {
    page = <OverviewPage />
  } else if (path.startsWith('/costs')) {
    page = <CostsPage />
  } else if (path.startsWith('/teams')) {
    page = <TeamsPage />
  } else if (path.startsWith('/settings')) {
    page = <SettingsPage />
  } else {
    page = <OverviewPage />
  }

  return <DashboardLayout>{page}</DashboardLayout>
}, 'App')
