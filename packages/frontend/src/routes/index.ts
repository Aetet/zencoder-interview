import { reatomRoute, urlAtom, effect } from '@reatom/core'

// Route definitions
export const overviewRoute = reatomRoute('overview')
export const costsRoute = reatomRoute('costs')
export const teamsRoute = reatomRoute('teams')
export const settingsRoute = reatomRoute('settings')

// Redirect / to /overview
effect(() => {
  const { pathname } = urlAtom()
  if (pathname === '/' || pathname === '') {
    overviewRoute.go({})
  }
}, 'router.redirectRoot')

export { urlAtom }
