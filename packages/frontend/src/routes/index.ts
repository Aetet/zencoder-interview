import { urlAtom } from '@reatom/core'

export { overviewRoute } from '../features/overview/overview-model'
export { costsRoute } from '../features/costs/costs-model'
export { teamsRoute } from '../features/teams/teams-model'
export { settingsRoute } from '../features/settings/settings-model'

// Redirect / to /overview on initial load
if (window.location.pathname === '/' || window.location.pathname === '') {
  history.replaceState(null, '', '/overview')
}

export { urlAtom }
