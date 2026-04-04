import { atom, computed } from '@reatom/core'

export const timeRange = atom<string>('30d', 'filters.timeRange')
export const teamFilter = atom<string>('', 'filters.team')
export const userFilter = atom<string>('', 'filters.user')
export const modelFilter = atom<string>('', 'filters.model')

// Memoized: only returns a new object when actual filter values change.
// Each atom read establishes a dependency — computed re-runs only when
// an atom value changes, and returns the same shape.
export const filterParams = computed((): Record<string, string> => {
  const params: Record<string, string> = {}
  const range = timeRange()
  if (range) params.range = range

  const team = teamFilter()
  if (team) params.team_id = team

  const user = userFilter()
  if (user) params.user_id = user

  const model = modelFilter()
  if (model) params.model = model

  return params
}, 'filters.params')
