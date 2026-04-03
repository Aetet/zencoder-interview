import { atom, action } from '@reatom/core'
import { api } from '../../shared/api/client'
import { filterParams } from '../../shared/filters/model'
import type { CostBreakdown, CacheData, BudgetData, TopFilesData } from '@zendash/shared'

export const costBreakdown = atom<CostBreakdown | null>(null, 'costs.breakdown')
export const cacheData = atom<CacheData | null>(null, 'costs.cache')
export const budgetData = atom<BudgetData | null>(null, 'costs.budget')
export const topFiles = atom<TopFilesData | null>(null, 'costs.topFiles')
export const costsLoading = atom(true, 'costs.loading')

export const fetchCosts = action(async () => {
  costsLoading.set(true)
  try {
    const params = filterParams()
    const [breakdown, cache, budget, files] = await Promise.all([
      api.costs.breakdown(params),
      api.costs.cache(params),
      api.costs.budget(),
      api.files.top(params),
    ])
    costBreakdown.set(breakdown)
    cacheData.set(cache)
    budgetData.set(budget)
    topFiles.set(files)
  } finally {
    costsLoading.set(false)
  }
}, 'costs.fetch')
