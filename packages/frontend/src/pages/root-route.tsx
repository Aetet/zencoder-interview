import { reatomRoute, urlAtom } from '@reatom/core'
import { overviewRoute } from './overview/overview-route'
import { costsRoute } from './costs/costs-route'
import { teamsRoute } from './teams/teams-route'
import { settingsRoute } from './settings/settings-route'
import { OverviewPage } from './overview/overview-page'
import { CostsPage } from './costs/costs-page'
import { SettingsPage } from './settings/settings-page'
import { DashboardLayout } from '../shared/components/DashboardLayout'

export const rootRoute = reatomRoute({
  render() {
    // Redirect / to /overview
    const { pathname } = urlAtom()
    if (pathname === '/' || pathname === '') {
      overviewRoute.go({}, true)
      return <></>
    }

    const isCosts = costsRoute.match()
    const isSettings = settingsRoute.match()
    const teamsRendered = teamsRoute.render()

    let page: React.ReactNode
    if (isCosts) {
      page = <CostsPage />
    } else if (teamsRendered) {
      page = teamsRendered
    } else if (isSettings) {
      page = <SettingsPage />
    } else {
      page = <OverviewPage />
    }

    return <DashboardLayout>{page}</DashboardLayout>
  },
})
