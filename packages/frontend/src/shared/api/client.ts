const BASE = '/api'

function qs(params: Record<string, string>): string {
  const filtered = Object.entries(params).filter(([, v]) => v !== '')
  if (filtered.length === 0) return ''
  return '?' + new URLSearchParams(filtered).toString()
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `API error: ${res.status}`
    try {
      const body = await res.json()
      if (body.error) message = body.error
    } catch { /* ignore parse errors */ }
    throw new Error(message)
  }
  return res.json()
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}${qs(params)}`)
  return handleResponse(res)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export const api = {
  sessions: {
    summary: (params: Record<string, string>) => get<import('@zendash/shared').SessionSummary>('/sessions/summary', params),
  },
  costs: {
    breakdown: (params: Record<string, string>) => get<import('@zendash/shared').CostBreakdown>('/costs/breakdown', params),
    cache: (params: Record<string, string>) => get<import('@zendash/shared').CacheData>('/costs/cache', params),
    budget: () => get<import('@zendash/shared').BudgetData>('/costs/budget'),
  },
  teams: {
    list: (params: Record<string, string>) => get<import('@zendash/shared').Team[]>('/teams', params),
    users: (teamId: string, params: Record<string, string>) => get<import('@zendash/shared').TeamUser[]>(`/teams/${teamId}/users`, params),
  },
  files: {
    top: (params: Record<string, string>) => get<import('@zendash/shared').TopFilesData>('/files/top', params),
  },
  insights: {
    list: (params: Record<string, string>) => get<import('@zendash/shared').Insight[]>('/insights', params),
  },
  quality: {
    tier1: (params: Record<string, string>) => get<import('@zendash/shared').QualityTier1>('/quality/tier1', params),
  },
  alerts: {
    list: () => get<import('@zendash/shared').AlertEvent[]>('/alerts'),
  },
  budgets: {
    get: () => get<{ monthlyBudget: number; teamOverrides: Record<string, number> }>('/budgets'),
    save: (config: { monthlyBudget: number; teamOverrides?: Record<string, number> }) => post<{ success: boolean }>('/budgets', config),
  },
}
