# Testing Strategy: ZenDash MVP

**Runner:** Vitest
**Date:** 2026-04-03

---

## 1. Three Testing Layers

| Layer | What | Tool | Runs |
|---|---|---|---|
| **Unit** | Reatom atoms, computed, actions, business logic, API handlers | Vitest | Every commit |
| **Component** | React components rendering, interaction, state binding | Vitest + linkedom | Every commit |
| **E2E** | Full user flows across browser | Vitest + Playwright | Pre-merge, CI |

### Test Pyramid

```
         /  E2E  \           ~15 tests   — critical user journeys
        / Component \        ~40 tests   — UI rendering + interactions
       /    Unit     \       ~80 tests   — atoms, computed, API handlers
```

---

## 2. Unit Tests (Reatom + Hono)

### 2.1 What to Test

**Reatom state:**
- Atom initial values and mutations via `.set()`
- Computed derivations — correct output when dependencies change
- Actions — side effects fire, state updates correctly
- `withAsyncData` — loading/ready/error states
- `withSearchParams` — URL sync behavior
- Filter atoms — `filterParams` computed produces correct query objects
- `reatomBoolean` — toggle, setTrue, setFalse
- `reatomForm` — field values, validation, submit flow

**Hono API handlers:**
- Each endpoint returns correct shape
- Query param filtering works
- Error responses (400, 404, 500)
- SSE endpoint streams events

### 2.2 How to Test Reatom

Reatom v1000 testing patterns (from reatom's own test suite):

**Key utilities:**
- `notify()` — flush synchronous updates to subscribers after `.set()`
- `wrap(promise)` — wrap async operations to preserve reatom context
- `wrap(sleep())` — flush microtasks (sleep with no args = microtask yield)
- `atom.subscribe(vi.fn())` — subscribe with a mock to track updates
- `context.reset` — reset global state between tests when atoms are module-scoped

```ts
// example: unit test for a filter atom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { atom, computed, notify, context } from '@reatom/core'

beforeEach(() => {
  context.reset()
})

describe('filters', () => {
  it('filterParams includes team_id when teamFilter is set', () => {
    const teamFilter = atom('', 'filters.team')
    const filterParams = computed(() => {
      const team = teamFilter()
      const params: Record<string, string> = { range: '30d' }
      if (team) params.team_id = team
      return params
    }, 'filters.params')

    // Subscribe to activate computed tracking
    const track = vi.fn()
    filterParams.subscribe(track)

    teamFilter.set('backend')
    notify()

    expect(filterParams()).toEqual({ range: '30d', team_id: 'backend' })
    expect(track).toBeCalledTimes(2) // initial + update
  })

  it('filterParams omits empty filters', () => {
    const teamFilter = atom('', 'filters.team')
    const filterParams = computed(() => {
      const team = teamFilter()
      const params: Record<string, string> = { range: '30d' }
      if (team) params.team_id = team
      return params
    }, 'filters.params')

    expect(filterParams()).toEqual({ range: '30d' })
  })
})
```

### 2.3 Testing Async (withAsyncData)

Use `wrap(sleep())` to flush microtasks. Mock fetch, then assert loading/ready/error states.

```ts
import { describe, it, expect, vi } from 'vitest'
import { atom, computed, withAsyncData, wrap } from '@reatom/core'
import { sleep } from '@reatom/core' // or a simple: const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))

describe('async data', () => {
  it('transitions through loading -> ready states', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: () => ({ total: 100 }) })
    globalThis.fetch = mockFetch

    const data = computed(async () => {
      const res = await wrap(fetch('/api/test'))
      return await wrap(res.json())
    }, 'test.data').extend(withAsyncData({ initState: null }))

    // Subscribe to activate the lazy computed
    data.data.subscribe(() => {})

    expect(data.ready()).toBe(false)

    // Flush microtasks
    await wrap(sleep())

    expect(data.ready()).toBe(true)
    expect(data.data()).toEqual({ total: 100 })
  })
})
```

### 2.4 Testing Hono API Handlers

Test handlers directly using Hono's `app.request()`.

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('GET /api/sessions/summary', () => {
  it('returns session counts with default 30d range', async () => {
    const res = await app.request('/api/sessions/summary?range=30d')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('totalSessions')
    expect(body).toHaveProperty('completionRate')
    expect(typeof body.totalSessions).toBe('number')
  })

  it('filters by team_id', async () => {
    const res = await app.request('/api/sessions/summary?range=30d&team_id=backend')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.totalSessions).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /api/overview/live', () => {
  it('returns SSE content-type', async () => {
    const res = await app.request('/api/overview/live')
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })
})

describe('POST /api/alerts', () => {
  it('saves budget alert thresholds', async () => {
    const res = await app.request('/api/alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: 6000, thresholds: [50, 75, 90, 100] }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects invalid budget', async () => {
    const res = await app.request('/api/alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: -100, thresholds: [] }),
    })
    expect(res.status).toBe(400)
  })
})
```

---

## 3. Component Tests (Vitest + linkedom)

### 3.1 Why linkedom

linkedom provides a lightweight DOM implementation (~50x faster than jsdom) suitable for rendering React components in Node.js. No browser needed.

### 3.2 Setup

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node', // not jsdom — we use linkedom manually for component tests
    globals: true,
  },
})
```

```ts
// test/setup-dom.ts — import in component test files
import { parseHTML } from 'linkedom'

const { document, window } = parseHTML('<!DOCTYPE html><html><body></body></html>')
globalThis.document = document
globalThis.window = window as any
globalThis.navigator = window.navigator
globalThis.HTMLElement = window.HTMLElement
```

### 3.3 What to Test

- Components render correct text/structure given atom state
- Components show loading/error states
- User interactions (click, input) update atoms
- Filter bar reflects atom state
- Navigation elements link to correct routes
- Conditional rendering (Go Live button text changes)
- Tables render correct number of rows
- KPI cards display formatted values

### 3.4 Pattern

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../test/setup-dom'

// Mock atoms to control state
vi.mock('../src/features/overview/model', () => ({
  isLive: { __proto__: atom.__proto__, ...(reatomBoolean(false, 'test.isLive')) },
  overviewData: { __proto__: computed.__proto__, ... },
}))

describe('GoLiveButton', () => {
  it('shows "Go Live" when not live', () => {
    render(<GoLiveButton />)
    expect(screen.getByText('Go Live')).toBeTruthy()
  })

  it('shows "Stop Live" when live', () => {
    isLive.setTrue()
    render(<GoLiveButton />)
    expect(screen.getByText('Stop Live')).toBeTruthy()
  })

  it('toggles live state on click', () => {
    render(<GoLiveButton />)
    fireEvent.click(screen.getByRole('button'))
    expect(isLive()).toBe(true)
  })
})
```

### 3.5 Component Test Scope

Keep component tests focused on **rendering logic**, not business logic. Business logic lives in atoms/computed and is covered by unit tests. Component tests verify the wiring.

---

## 4. E2E Tests (Vitest + Playwright)

### 4.1 Setup

```ts
// vitest.config.e2e.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
```

```ts
// e2e/helpers.ts
import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('http://localhost:3000')
    await use(page)
  },
})
export { expect }
```

### 4.2 What to Test

E2E tests cover **critical user journeys** — the paths that prove the MVP hypothesis. Not every edge case.

- Dashboard loads and shows KPI cards
- Navigation between views works
- Filters change data and persist in URL
- Cost breakdown displays and filter updates it
- Team drill-down works
- Budget form saves
- Go Live toggles SSE connection
- CSV export downloads a file
- Shareable links restore filter state

### 4.3 Pattern

```ts
import { test, expect } from './helpers'

test('overview loads with KPI cards', async ({ page }) => {
  await page.waitForSelector('[data-testid="kpi-total-sessions"]')
  const sessions = await page.textContent('[data-testid="kpi-total-sessions"]')
  expect(sessions).toMatch(/[\d,]+/) // contains a number
})

test('filter by team updates cost view', async ({ page }) => {
  await page.click('[data-testid="nav-costs"]')
  await page.selectOption('[data-testid="filter-team"]', 'backend')
  await page.waitForSelector('[data-testid="cost-total-spend"]')
  // URL should contain team filter
  expect(page.url()).toContain('team=backend')
})
```

---

## 5. Test File Organization

```
packages/
  frontend/
    src/
      features/overview/__tests__/
        model.test.ts           # Unit: overview atoms, computed, live toggle
        OverviewPage.test.tsx   # Component: rendering, interactions
      features/costs/__tests__/
        model.test.ts
        CostsPage.test.tsx
      features/teams/__tests__/
        model.test.ts
        TeamsPage.test.tsx
      features/settings/__tests__/
        model.test.ts
        SettingsPage.test.tsx
      shared/filters/__tests__/
        model.test.ts           # Unit: filter atoms, filterParams computed
      shared/api/__tests__/
        client.test.ts          # Unit: RPC client setup
  backend/
    src/__tests__/
      sessions.test.ts          # Unit: session summary endpoint
      costs.test.ts             # Unit: cost breakdown, cache, budget endpoints
      teams.test.ts             # Unit: teams list, team detail, users
      alerts.test.ts            # Unit: alert CRUD
      live.test.ts              # Unit: SSE endpoint
      files.test.ts             # Unit: top files endpoint
      insights.test.ts          # Unit: insights endpoint
  e2e/
    overview.test.ts            # E2E: overview journey
    costs.test.ts               # E2E: cost analysis journey
    teams.test.ts               # E2E: team drill-down journey
    settings.test.ts            # E2E: budget + alerts journey
    navigation.test.ts          # E2E: nav, filters, URL sharing
```

---

## 6. CI Pipeline

```yaml
# Run order:
# 1. Unit tests (fast, no deps) — ~5s
# 2. Component tests (linkedom, no browser) — ~10s
# 3. E2E tests (Playwright, needs running app) — ~60s

test:unit:
  script: pnpm --filter frontend test:unit && pnpm --filter backend test

test:component:
  script: pnpm --filter frontend test:component

test:e2e:
  needs: [test:unit, test:component]
  script: |
    pnpm --filter backend dev &
    pnpm --filter frontend dev &
    sleep 5
    pnpm --filter e2e test
```

---

## 7. Test Data

All tests use the same mock data seed described in [MVP Scope Section 5.2](./mvp-scope.md):
- 1 org, 6 teams, 50 users, 3,000 sessions over 30 days
- Backend serves this from in-memory JSON — no database
- Unit tests can import mock data directly: `import { mockSessions } from '../test/fixtures'`
- E2E tests hit the running mock backend

### Fixtures Location

```
packages/
  shared/
    test-fixtures/
      sessions.json       # 3,000 session records
      teams.json           # 6 teams
      users.json           # 50 users
      pricing.json         # Model pricing tiers
```

Shared between backend (serves them) and frontend unit tests (imports them).
