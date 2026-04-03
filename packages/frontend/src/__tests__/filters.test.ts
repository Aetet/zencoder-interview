import { describe, it, expect } from 'vitest'
import { atom, computed } from '@reatom/core'

describe('filter atoms', () => {
  it('filterParams includes range by default', () => {
    const timeRange = atom('30d', 'test.timeRange')
    const teamFilter = atom('', 'test.team')
    const modelFilter = atom('', 'test.model')

    const filterParams = computed(() => {
      const params: Record<string, string> = {}
      const range = timeRange()
      if (range) params.range = range
      const team = teamFilter()
      if (team) params.team_id = team
      const model = modelFilter()
      if (model) params.model = model
      return params
    }, 'test.filterParams')

    expect(filterParams()).toEqual({ range: '30d' })
  })

  it('filterParams includes team_id when set', () => {
    const timeRange = atom('30d', 'test2.timeRange')
    const teamFilter = atom('backend', 'test2.team')
    const modelFilter = atom('', 'test2.model')

    const filterParams = computed(() => {
      const params: Record<string, string> = {}
      const range = timeRange()
      if (range) params.range = range
      const team = teamFilter()
      if (team) params.team_id = team
      const model = modelFilter()
      if (model) params.model = model
      return params
    }, 'test2.filterParams')

    expect(filterParams()).toEqual({ range: '30d', team_id: 'backend' })
  })

  it('filterParams includes multiple filters', () => {
    const timeRange = atom('7d', 'test3.timeRange')
    const teamFilter = atom('frontend', 'test3.team')
    const modelFilter = atom('opus', 'test3.model')

    const filterParams = computed(() => {
      const params: Record<string, string> = {}
      const range = timeRange()
      if (range) params.range = range
      const team = teamFilter()
      if (team) params.team_id = team
      const model = modelFilter()
      if (model) params.model = model
      return params
    }, 'test3.filterParams')

    expect(filterParams()).toEqual({ range: '7d', team_id: 'frontend', model: 'opus' })
  })

  it('filterParams omits empty strings', () => {
    const timeRange = atom('30d', 'test4.timeRange')
    const teamFilter = atom('', 'test4.team')
    const modelFilter = atom('', 'test4.model')

    const filterParams = computed(() => {
      const params: Record<string, string> = {}
      const range = timeRange()
      if (range) params.range = range
      const team = teamFilter()
      if (team) params.team_id = team
      const model = modelFilter()
      if (model) params.model = model
      return params
    }, 'test4.filterParams')

    const result = filterParams()
    expect(result).not.toHaveProperty('team_id')
    expect(result).not.toHaveProperty('model')
  })
})
