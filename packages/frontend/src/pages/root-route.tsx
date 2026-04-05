import { reatomRoute, urlAtom } from '@reatom/core'
import { overviewRoute } from './overview/overview-route'
import { costsRoute } from './costs/costs-route'
import { teamsRoute } from './teams/teams-route'
import { alertsRoute } from './settings/alerts-route'
import { OverviewPage } from './overview/overview-page'
import { CostsPage } from './costs/costs-page'
import { TeamsPage } from './teams/teams-page'
import { AlertsPage } from './settings/alerts-page'
import { DashboardLayout } from '../shared/components/DashboardLayout'

export const rootRoute = reatomRoute({
  render() {
    const { pathname } = urlAtom()
    if (pathname === '/' || pathname === '') {
      overviewRoute.go({}, true)
      return <></>
    }

    const isTeams = teamsRoute.match()
    const isCosts = costsRoute.match()
    const isAlerts = alertsRoute.match()

    let page: React.ReactNode
    if (isTeams) {
      page = <TeamsPage />
    } else if (isCosts) {
      page = <CostsPage />
    } else if (isAlerts) {
      page = <AlertsPage />
    } else {
      page = <OverviewPage />
    }

    return <DashboardLayout>{page}</DashboardLayout>
  },
})
