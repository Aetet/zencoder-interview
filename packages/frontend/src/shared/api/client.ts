import { hc } from "hono/client"
import type { AppType } from "backend/app"

const client = hc<AppType>("")

export const api = {
  sessions: {
    summary: (params: Record<string, string>) =>
      client.api.sessions.summary.$get({ query: params }).then(r => r.json()),
  },
  costs: {
    breakdown: (params: Record<string, string>) =>
      client.api.costs.breakdown.$get({ query: params }).then(r => r.json()),
    cache: (params: Record<string, string>) => client.api.costs.cache.$get({ query: params }).then(r => r.json()),
    budget: () => client.api.costs.budget.$get().then(r => r.json()),
  },
  teams: {
    list: (params: Record<string, string>) => client.api.teams.$get({ query: params }).then(r => r.json()),
    users: async (teamId: string, params: Record<string, string>) => {
      const res = await client.api.teams[":id"].users.$get({ param: { id: teamId }, query: params })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      return res.json()
    },
  },
  files: {
    top: (params: Record<string, string>) => client.api.files.top.$get({ query: params }).then(r => r.json()),
  },
  insights: {
    list: (params: Record<string, string>) => client.api.insights.$get({ query: params }).then(r => r.json()),
  },
  quality: {
    tier1: (params: Record<string, string>) => client.api.quality.tier1.$get({ query: params }).then(r => r.json()),
  },
  alerts: {
    list: () => client.api.alerts.$get().then(r => r.json()),
  },
  budgets: {
    get: () => client.api.budgets.$get().then(r => r.json()),
    save: async (config: { monthlyBudget: number; teamOverrides?: Record<string, number> }) => {
      const res = await client.api.budgets.$post({ json: config })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      return res.json()
    },
  },
}
