import { atom, action } from '@reatom/core'

// Simple path-based router atom
export const currentPath = atom(window.location.pathname, 'router.path')

export const navigate = action((path: string) => {
  window.history.pushState({}, '', path)
  currentPath.set(path)
}, 'router.navigate')

window.addEventListener('popstate', () => {
  currentPath.set(window.location.pathname)
})
