import { reatomComponent } from '@reatom/react'
import { overviewRoute, costsRoute, teamsRoute, settingsRoute } from './routes'
import { DashboardLayout } from './shared/components/DashboardLayout'
import { OverviewPage } from './features/overview/OverviewPage'
import { CostsPage } from './features/costs/CostsPage'
import { TeamsPage } from './features/teams/TeamsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { FpsCounter } from './shared/components/FpsCounter'

export const App = reatomComponent(() => {
  const isOverview = overviewRoute.match()
  const isCosts = costsRoute.match()
  const isTeams = teamsRoute.match()
  const isSettings = settingsRoute.match()

  let page: React.ReactNode
  if (isCosts) {
    page = <CostsPage />
  } else if (isTeams) {
    page = <TeamsPage />
  } else if (isSettings) {
    page = <SettingsPage />
  } else {
    page = <OverviewPage />
  }

  return (
    <>
      <DashboardLayout>{page}</DashboardLayout>
      <FpsCounter />
    </>
  )
}, 'App')
