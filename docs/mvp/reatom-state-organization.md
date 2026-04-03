# Reatom State Organization: ZenDash

**Packages:** `@reatom/core@1000.15.2`, `@reatom/react@1000.2.2`
**Reference:** [Reatom v1000 docs](https://v1000.reatom.dev), [summary.md](https://github.com/reatom/reatom/blob/v1000/summary.md)
**Date:** 2026-04-03

---

## 1. Reatom v1000 Quick Reference

### Core Primitives

| Primitive | Purpose | Example |
|---|---|---|
| `atom` | Mutable state | `atom<number>(0, 'counter')` |
| `computed` | Derived state (lazy, tracked) | `computed(() => counter() * 2, 'double')` |
| `action` | Callable event / side effect | `action(async (id: string) => { ... }, 'fetchUser')` |
| `effect` | Auto-subscribing side effect | `effect(() => { ... }, 'syncEffect')` |
| `wrap` | Preserves async context | `await wrap(fetch(url))` |

### Key Rules

- **Always name** atoms, computed, actions — second argument is the name string
- **Use `computed()`** for derived values, NOT `atom(() => {})`
- **Use `wrap()`** on every async boundary — fetch, setTimeout, addEventListener
- **Do not chain after `wrap()`** — wrap each step separately
- **Prefer `computed` + `withAsyncData`** for data fetching (not manual action + effect)

### Data Fetching Pattern

```ts
import { atom, computed, withAsyncData, wrap } from '@reatom/core'

const page = atom(1, 'users.page')

// Reactive async data — refetches when page() changes, only while subscribed
const users = computed(async () => {
  const p = page()
  const res = await wrap(fetch(`/api/users?page=${p}`))
  return await wrap(res.json())
}, 'users').extend(withAsyncData({ initState: [] }))

// Usage:
// users.data()   — the fetched data ([] initially)
// users.ready()  — false while loading, true when loaded
// users.error()  — error if failed
// users.retry()  — re-trigger fetch
// users.reset()  — reset to initial state
```

### Async Actions (mutations, non-idempotent)

```ts
import { action, withAsync, wrap } from '@reatom/core'

const saveBudget = action(async (amount: number) => {
  const res = await wrap(fetch('/api/budget', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }))
  if (!res.ok) throw new Error('Failed to save')
}, 'settings.saveBudget').extend(withAsync())

// saveBudget.ready()  — true when not in flight
// saveBudget.error()  — last error
```

### React Integration

```tsx
import { reatomComponent } from '@reatom/react'

// ALL components using reatom atoms or hooks MUST use reatomComponent
export const UserList = reatomComponent(() => {
  const data = users.data()
  const ready = users.ready()

  if (!ready) return <div>Loading...</div>
  return <ul>{data.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}, 'UserList')
```

### Primitives Helpers

```ts
import { reatomBoolean, reatomEnum } from '@reatom/core'

const isLive = reatomBoolean(false, 'overview.isLive')
// isLive.setTrue(), isLive.setFalse(), isLive.toggle()

const timeRange = reatomEnum(['today', '7d', '30d', '90d', 'custom'], 'filters.timeRange')
// timeRange(), timeRange.set30d(), timeRange.enum.today
```

---

## 2. Dashboard State Architecture

### File Structure

```
src/
  routes/
    index.ts              # All route definitions
  features/
    overview/
      model.ts            # Overview atoms, computed, live mode
      OverviewPage.tsx     # reatomComponent
    costs/
      model.ts            # Cost atoms, computed
      CostsPage.tsx
    teams/
      model.ts            # Teams atoms, computed
      TeamsPage.tsx
    settings/
      model.ts            # Settings form, alerts
      SettingsPage.tsx
  shared/
    filters/
      model.ts            # Global filter atoms (time range, team, user, model)
    api/
      client.ts           # Hono RPC client instance
  App.tsx                 # Root reatomComponent with layout + router
  setup.ts                # Logger, dev tools
```

### Naming Conventions (from CLAUDE.md)

- Atoms: `overview.totalSessions`, `costs.tokenBreakdown`
- Actions: `settings.saveBudget`, `overview.goLive`
- Computed: `overview.kpiCards`, `costs.cacheHitRate`
- Factories: `createTeamDetail('teams.detail')` — prefix with `create*`
- Dynamic atoms: `teams.list#${teamId}.sessions`

---

## 3. Route Definitions

### Route Tree

```
layoutRoute (no path — wraps all views with sidebar + filter bar)
├── overviewRoute       path: ''              (landing page)
├── costsRoute          path: 'costs'
├── teamsRoute          path: 'teams'
│   └── teamDetailRoute path: ':teamId'
└── settingsRoute       path: 'settings'
```

### Implementation

```ts
// src/routes/index.ts
import { reatomRoute } from '@reatom/core'
import { z } from 'zod/v4'

// Layout route — always active, renders sidebar + filter bar + outlet
export const layoutRoute = reatomRoute({
  render(self) {
    return (
      <DashboardLayout>
        {self.outlet()}
      </DashboardLayout>
    )
  },
})

// Overview — landing page, supports Go Live mode
export const overviewRoute = layoutRoute.reatomRoute({
  path: '',
  async loader() {
    const [summary, costs, insights, leaderboard] = await Promise.all([
      wrap(api.sessions.summary.$get({ query: getFilterParams() }).then(r => r.json())),
      wrap(api.costs.breakdown.$get({ query: getFilterParams() }).then(r => r.json())),
      wrap(api.insights.$get({ query: getFilterParams() }).then(r => r.json())),
      wrap(api.teams.$get({ query: getFilterParams() }).then(r => r.json())),
    ])
    return { summary, costs, insights, leaderboard }
  },
  render(self) {
    if (!self.loader.ready()) return <OverviewSkeleton />
    return <OverviewPage />
  },
})

// Costs
export const costsRoute = layoutRoute.reatomRoute({
  path: 'costs',
  async loader() {
    const [breakdown, cache, budget, topFiles] = await Promise.all([
      wrap(api.costs.breakdown.$get({ query: getFilterParams() }).then(r => r.json())),
      wrap(api.costs.cache.$get({ query: getFilterParams() }).then(r => r.json())),
      wrap(api.costs.budget.$get().then(r => r.json())),
      wrap(api.files.top.$get({ query: getFilterParams() }).then(r => r.json())),
    ])
    return { breakdown, cache, budget, topFiles }
  },
  render(self) {
    if (!self.loader.ready()) return <CostsSkeleton />
    return <CostsPage />
  },
})

// Teams — list view + detail drill-down
export const teamsRoute = layoutRoute.reatomRoute({
  path: 'teams',
  async loader() {
    return await wrap(api.teams.$get({ query: getFilterParams() }).then(r => r.json()))
  },
  render(self) {
    if (!self.loader.ready()) return <TeamsSkeleton />
    return <TeamsPage />
  },
})

export const teamDetailRoute = teamsRoute.reatomRoute({
  path: ':teamId',
  params: z.object({ teamId: z.string() }),
  async loader({ teamId }) {
    const [team, users] = await Promise.all([
      wrap(api.teams[':id'].$get({ param: { id: teamId }, query: getFilterParams() }).then(r => r.json())),
      wrap(api.teams[':id'].users.$get({ param: { id: teamId }, query: getFilterParams() }).then(r => r.json())),
    ])
    return { team, users }
  },
  render(self) {
    if (!self.loader.ready()) return <TeamDetailSkeleton />
    return <TeamDetailPage />
  },
})

// Settings — no loader needed, form-based
export const settingsRoute = layoutRoute.reatomRoute({
  path: 'settings',
  async loader() {
    return await wrap(api.costs.budget.$get().then(r => r.json()))
  },
  render(self) {
    if (!self.loader.ready()) return <SettingsSkeleton />
    return <SettingsPage />
  },
})
```

### App Root

```tsx
// src/App.tsx
import { reatomComponent } from '@reatom/react'
import { layoutRoute } from './routes'

export const App = reatomComponent(() => {
  return <>{layoutRoute.render()}</>
}, 'App')
```

---

## 4. Data Fetching with Hono RPC

### Client Setup

```ts
// src/shared/api/client.ts
import { hc } from 'hono/client'
import type { AppType } from '../../backend/src/index' // shared type from backend

export const api = hc<AppType>('/api')
```

### Pattern: Route Loader + Hono RPC

Route loaders fetch data when the route becomes active. Data is available via `route.loader.data()` and auto-aborts on navigation away.

```ts
// Inside route loader:
async loader() {
  const res = await wrap(api.sessions.summary.$get({
    query: { from: filterFrom(), to: filterTo(), team_id: filterTeam() }
  }))
  return await wrap(res.json())
}
```

### Pattern: Standalone Computed (for data shared across routes)

When data is needed by multiple routes, use a standalone `computed` + `withAsyncData` outside any specific route:

```ts
// src/shared/api/teamList.ts
import { computed, withAsyncData, wrap } from '@reatom/core'

export const teamList = computed(async () => {
  const res = await wrap(api.teams.$get())
  return await wrap(res.json())
}, 'shared.teamList').extend(withAsyncData({ initState: [] }))

// Used by: filter dropdown (all views), Teams page, Overview leaderboard
```

---

## 5. Global Filters (URL-Synced)

Filters live in the URL via `withSearchParams` so they're shareable and persist across navigation.

```ts
// src/shared/filters/model.ts
import { atom, computed, withSearchParams, reatomEnum } from '@reatom/core'

// Time range — enum with URL sync
export const timeRange = atom<'today' | '7d' | '30d' | '90d' | 'custom'>(
  '30d',
  'filters.timeRange'
).extend(withSearchParams('range'))

// Custom date range (only used when timeRange === 'custom')
export const dateFrom = atom('', 'filters.dateFrom').extend(withSearchParams('from'))
export const dateTo = atom('', 'filters.dateTo').extend(withSearchParams('to'))

// Team filter
export const teamFilter = atom('', 'filters.team').extend(
  withSearchParams('team', (value) => value ?? '')
)

// User filter
export const userFilter = atom('', 'filters.user').extend(
  withSearchParams('user', (value) => value ?? '')
)

// Model filter
export const modelFilter = atom('', 'filters.model').extend(
  withSearchParams('model', (value) => value ?? '')
)

// Computed query params object for API calls
export const filterParams = computed(() => {
  const range = timeRange()
  const params: Record<string, string> = {}

  if (range === 'custom') {
    params.from = dateFrom()
    params.to = dateTo()
  } else {
    params.range = range
  }

  const team = teamFilter()
  if (team) params.team_id = team

  const user = userFilter()
  if (user) params.user_id = user

  const model = modelFilter()
  if (model) params.model = model

  return params
}, 'filters.params')

// Helper for route loaders
export function getFilterParams() {
  return filterParams()
}
```

**How it works:** When the user changes a filter, the atom updates, the URL search params update (via `withSearchParams`), and any route loader that calls `filterParams()` inside its `computed` will automatically re-run because `filterParams` depends on the filter atoms.

---

## 6. Overview "Go Live" Mode (SSE)

Only the Overview screen supports live mode. Uses `reatomBoolean` for toggle state and `withConnectHook` pattern for the EventSource lifecycle.

```ts
// src/features/overview/model.ts
import {
  atom,
  computed,
  action,
  effect,
  reatomBoolean,
  withConnectHook,
  wrap,
} from '@reatom/core'
import { getFilterParams } from '../../shared/filters/model'

// Live mode toggle
export const isLive = reatomBoolean(false, 'overview.isLive')

// Live data stream — only active when isLive is true and overview route matches
export const liveData = atom<OverviewData | null>(null, 'overview.liveData').extend(
  withConnectHook(() => {
    // This runs when liveData gets its first subscriber
    // and auto-cleans on disconnect

    effect(() => {
      if (!isLive()) return

      const params = new URLSearchParams(getFilterParams())
      const eventSource = new EventSource(`/api/overview/live?${params}`)

      eventSource.onmessage = wrap((event) => {
        const data = JSON.parse(event.data)
        liveData.set(data)
      })

      eventSource.onerror = wrap(() => {
        eventSource.close()
        isLive.setFalse()
      })

      // Cleanup on disconnect or when isLive becomes false
      return () => {
        eventSource.close()
      }
    }, 'overview.liveEffect')
  }),
)

// The view reads from either live data or loader data
export const overviewData = computed(() => {
  if (isLive()) {
    return liveData()
  }
  return overviewRoute.loader.data()
}, 'overview.data')
```

### Component Usage

```tsx
// src/features/overview/OverviewPage.tsx
import { reatomComponent } from '@reatom/react'
import { isLive, overviewData } from './model'
import { wrap } from '@reatom/core'

export const GoLiveButton = reatomComponent(() => {
  const live = isLive()

  return (
    <button
      onClick={wrap(() => isLive.toggle())}
      className={live
        ? 'bg-transparent border border-error text-error'
        : 'bg-primary text-primary-foreground'
      }
    >
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
        live ? 'bg-error animate-pulse' : 'bg-white'
      }`} />
      {live ? 'Stop Live' : 'Go Live'}
    </button>
  )
}, 'GoLiveButton')
```

---

## 7. Settings Form

Uses `reatomForm` for budget configuration with validation.

```ts
// src/features/settings/model.ts
import { reatomForm, reatomField, action, withAsync, wrap } from '@reatom/core'
import { z } from 'zod/v4'

export const budgetForm = reatomForm(
  {
    monthlyBudget: reatomField('6000', {
      validate: ({ state }) => {
        const num = Number(state)
        return !isNaN(num) && num > 0 ? undefined : 'Must be a positive number'
      },
    }),
    alert50: true,
    alert75: true,
    alert90: true,
    alert100: true,
  },
  {
    name: 'settings.budgetForm',
    onSubmit: async (values) => {
      await wrap(api.alerts.$post({
        json: {
          monthlyBudget: Number(values.monthlyBudget),
          thresholds: [
            values.alert50 && 50,
            values.alert75 && 75,
            values.alert90 && 90,
            values.alert100 && 100,
          ].filter(Boolean),
        },
      }))
    },
  },
)
```

### Form Component

```tsx
// src/features/settings/SettingsPage.tsx
import { reatomComponent, bindField } from '@reatom/react'
import { budgetForm } from './model'
import { wrap } from '@reatom/core'

export const BudgetFormSection = reatomComponent(() => {
  const { fields, submit } = budgetForm

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }}>
      <label>Monthly Budget (USD)</label>
      <input type="number" {...bindField(fields.monthlyBudget)} />

      <label>
        <input type="checkbox" {...bindField(fields.alert50)} />
        50% threshold
      </label>
      {/* ... other thresholds ... */}

      <button type="submit" disabled={!submit.ready()}>
        Save Changes
      </button>
    </form>
  )
}, 'BudgetFormSection')
```

---

## 8. CSV Export

Simple action — no persistent state needed.

```ts
// src/shared/export/model.ts
import { action, withAsync, wrap } from '@reatom/core'
import { getFilterParams } from '../filters/model'

export const exportCsv = action(async () => {
  const params = new URLSearchParams(getFilterParams())
  // Determine which view we're on from the current route
  const currentView = overviewRoute.match() ? 'overview'
    : costsRoute.match() ? 'costs'
    : teamsRoute.match() ? 'teams'
    : 'unknown'

  const res = await wrap(fetch(`/api/export/${currentView}?${params}`))
  const blob = await wrap(res.blob())

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zendash-${currentView}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}, 'export.csv').extend(withAsync())
```

---

## 9. Summary: State by Feature

| Feature | State Type | Atoms / Computed |
|---|---|---|
| **Filters** | URL-synced atoms | `timeRange`, `teamFilter`, `userFilter`, `modelFilter`, `filterParams` |
| **Overview** | Route loader + live SSE | `overviewRoute.loader`, `isLive`, `liveData`, `overviewData` |
| **Costs** | Route loader | `costsRoute.loader` (breakdown, cache, budget, topFiles) |
| **Teams** | Route loader + nested | `teamsRoute.loader`, `teamDetailRoute.loader` |
| **Settings** | Form | `budgetForm` (fields, submit, validation) |
| **Export** | Action | `exportCsv` |
| **Shared** | Computed | `teamList` (used by filter dropdown) |

### Key Patterns

1. **Route loaders for page data** — fetch on route activation, auto-abort on navigation
2. **`computed` + `withAsyncData`** for shared/reactive data — refetches when deps change
3. **`withSearchParams`** for URL-synced filter state — shareable links
4. **`reatomBoolean`** for simple toggles (live mode)
5. **`reatomForm`** for settings — validation, submit, error handling
6. **`withConnectHook`** for SSE lifecycle — auto-cleanup on disconnect
7. **`wrap()`** on every async boundary — fetch, EventSource callbacks, blob operations
