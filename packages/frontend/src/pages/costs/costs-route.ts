import { computed, reatomRoute, wrap } from '@reatom/core'
import { api } from '../../shared/api/client'
import { filterParams } from '../../shared/filters/model'
import type { CostBreakdown, CacheData, BudgetData, TopFilesData } from '@zendash/shared'

export const costsRoute = reatomRoute({
  path: 'costs',
  async loader() {
    const params = filterParams()
    const [breakdown, cache, budget, files] = await Promise.all([
      wrap(api.costs.breakdown(params)),
      wrap(api.costs.cache(params)),
      wrap(api.costs.budget()),
      wrap(api.files.top(params)),
    ])
    return { breakdown, cache, budget, files }
  },
}).extend((route) => {
  const INITIAL = {
    breakdown: null as CostBreakdown | null,
    cache: null as CacheData | null,
    budget: null as BudgetData | null,
    files: null as TopFilesData | null,
  }

  function data() {
    return route.loader.data() ?? INITIAL
  }

  const breakdown = computed(() => data().breakdown, 'costs.breakdown')
  const cache = computed(() => data().cache, 'costs.cache')
  const budget = computed(() => data().budget, 'costs.budget')
  const files = computed(() => data().files, 'costs.files')

  return { breakdown, cache, budget, files }
})
