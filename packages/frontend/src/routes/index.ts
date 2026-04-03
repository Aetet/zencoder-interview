import { atom, action } from '@reatom/core'

export const currentPath = atom(window.location.pathname, 'router.path')

export const navigate = action((path: string) => {
  window.history.pushState({}, '', path)
  currentPath.set(path)
}, 'router.navigate')

// Listen for browser back/forward
window.addEventListener('popstate', () => {
  currentPath.set(window.location.pathname)
})
