# Architecture: ZenDash MVP

**Date:** 2026-04-03

---

## 1. Overview

Two apps in a pnpm monorepo. Backend serves mock data + API. Frontend renders the dashboard. Shared types between them via Hono RPC.

```
zendash/
├── package.json              # Workspace root
├── pnpm-workspace.yaml
├── oxlint.json               # Oxlint config (formatter/linter)
├── packages/
│   ├── backend/              # Hono API server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts      # Hono app + server entry
│   │       ├── routes/       # Route handlers
│   │       ├── mock/         # Mock data generators + fixtures
│   │       └── types.ts      # Shared API types (exported for frontend)
│   ├── frontend/             # React SPA
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx      # Entry point
│   │       ├── App.tsx       # Root component
│   │       ├── app.css       # Global styles + CSS variables
│   │       ├── routes/       # Route definitions
│   │       ├── features/     # Feature modules (overview, costs, teams, settings)
│   │       ├── shared/       # Shared atoms, components, utils
│   │       └── test/         # Test setup + fixtures
│   └── shared/               # Shared types between frontend and backend
│       ├── package.json
│       └── src/
│           └── types.ts      # API response types, shared interfaces
```

---

## 2. Backend

### Stack

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js | 20+ |
| Framework | Hono | latest |
| RPC | Hono RPC | built-in |
| Language | TypeScript | 5.x |
| Mock data | In-memory, generated at startup | — |

### Architecture

```
backend/src/
├── index.ts              # Creates Hono app, registers routes, starts server
├── routes/
│   ├── sessions.ts       # GET /api/sessions/summary
│   ├── costs.ts          # GET /api/costs/breakdown, /cache, /budget
│   ├── teams.ts          # GET /api/teams, /api/teams/:id/users
│   ├── files.ts          # GET /api/files/top
│   ├── insights.ts       # GET /api/insights
│   ├── quality.ts        # GET /api/quality/tier1
│   ├── alerts.ts         # POST /api/alerts, GET /api/alerts
│   └── live.ts           # GET /api/overview/live (SSE)
├── mock/
│   ├── generator.ts      # Generates all mock data at startup
│   ├── sessions.ts       # Session generation logic
│   ├── teams.ts          # Team + user generation
│   ├── pricing.ts        # Model pricing tiers
│   └── store.ts          # In-memory data store (singleton)
└── types.ts              # Route types exported for Hono RPC
```

### Key Design Decisions

1. **Hono RPC** — backend exports `AppType` from `index.ts`. Frontend imports it to get fully typed API client.
2. **Mock store** — all mock data generated once at startup into an in-memory store. No database. Endpoints query the store with filter logic.
3. **SSE endpoint** — `/api/overview/live` uses Hono's `streamSSE` helper. Pushes aggregated data every 5 seconds. Adds small random variation to simulate real-time changes.
4. **CORS** — enabled for development (`localhost:5173` → `localhost:3001`).
5. **Budget state** — stored in-memory. POST /api/alerts writes to store, GET reads from it.

### API Type Export Pattern

```ts
// backend/src/index.ts
import { Hono } from 'hono'
import { sessions } from './routes/sessions'
import { costs } from './routes/costs'
// ... other routes

const app = new Hono()
  .route('/api/sessions', sessions)
  .route('/api/costs', costs)
  .route('/api/teams', teams)
  .route('/api/files', files)
  .route('/api/insights', insights)
  .route('/api/quality', quality)
  .route('/api/alerts', alerts)
  .route('/api/overview', live)

export type AppType = typeof app
export default app
```

---

## 3. Frontend

### Stack

| Layer | Choice | Version |
|---|---|---|
| Build | Vite | 6.x |
| Framework | React | 19.x |
| State | Reatom | `@reatom/core@1000.15.2`, `@reatom/react@1000.2.2` |
| Routing | Reatom routing | `reatomRoute` from `@reatom/core` |
| API client | Hono RPC | `hono/client` |
| Styling | Tailwind CSS | 4.x |
| Charts | Recharts | latest |
| Formatter | oxlint | via oxc |

### Architecture

```
frontend/src/
├── main.tsx                    # React root + setup
├── App.tsx                     # reatomComponent, renders layoutRoute
├── app.css                     # CSS variables + Tailwind imports
├── routes/
│   └── index.ts                # All reatomRoute definitions
├── features/
│   ├── overview/
│   │   ├── model.ts            # Atoms: isLive, liveData, overviewData
│   │   ├── OverviewPage.tsx    # KPI cards, charts, insights, leaderboard
│   │   └── components/
│   │       ├── KpiCard.tsx
│   │       ├── SessionsChart.tsx
│   │       ├── CostChart.tsx
│   │       ├── InsightsPanel.tsx
│   │       ├── TeamLeaderboard.tsx
│   │       └── GoLiveButton.tsx
│   ├── costs/
│   │   ├── model.ts
│   │   ├── CostsPage.tsx
│   │   └── components/
│   │       ├── TokenBreakdownChart.tsx
│   │       ├── CacheEfficiencyPanel.tsx
│   │       ├── BudgetTracker.tsx
│   │       └── TopFilesTable.tsx
│   ├── teams/
│   │   ├── model.ts
│   │   ├── TeamsPage.tsx
│   │   ├── TeamDetailPage.tsx
│   │   └── components/
│   │       ├── TeamComparisonTable.tsx
│   │       ├── UserTable.tsx
│   │       ├── AdoptionChart.tsx
│   │       └── ModelUsageChart.tsx
│   └── settings/
│       ├── model.ts
│       ├── SettingsPage.tsx
│       └── components/
│           ├── BudgetForm.tsx
│           ├── AlertThresholds.tsx
│           ├── TeamBudgetTable.tsx
│           └── AlertHistory.tsx
├── shared/
│   ├── api/
│   │   └── client.ts           # hc<AppType> instance
│   ├── filters/
│   │   └── model.ts            # Global filter atoms (withSearchParams)
│   ├── export/
│   │   └── model.ts            # CSV export action
│   ├── components/
│   │   ├── DashboardLayout.tsx  # Sidebar + filter bar + outlet
│   │   ├── Sidebar.tsx
│   │   ├── FilterBar.tsx
│   │   ├── Card.tsx             # Reusable card wrapper
│   │   ├── DataTable.tsx        # Generic table component
│   │   ├── ProgressBar.tsx
│   │   ├── Badge.tsx
│   │   └── Skeleton.tsx
│   └── utils/
│       ├── format.ts           # Number/currency/date formatting
│       └── cn.ts               # className merge utility
└── test/
    ├── setup-dom.ts            # linkedom setup
    └── fixtures/               # Symlink or import from shared
```

### Data Flow

```
User interaction (filter change, navigation)
  → Reatom atom update (e.g., timeRange.set('7d'))
  → URL search params update (via withSearchParams)
  → Route loader re-triggers (reads filterParams() inside computed)
  → Hono RPC call (typed, auto-complete)
  → Backend queries mock store with filters
  → Response flows back to route.loader.data()
  → reatomComponent re-renders
```

### Vite Proxy

Frontend dev server proxies `/api` to backend:

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

---

## 4. Shared Package

Minimal package that exports TypeScript types used by both frontend and backend:

```ts
// shared/src/types.ts
export interface SessionSummary {
  totalSessions: number
  completedSessions: number
  completionRate: number
  activeUsers: number
  totalUsers: number
  adoptionRate: number
  costPerSession: number
  totalCost: number
  trend: { date: string; sessions: number; completed: number; errored: number; cancelled: number }[]
  costTrend: { date: string; cost: number }[]
}

export interface CostBreakdown {
  total: number
  byTeam: { teamId: string; teamName: string; cost: number }[]
  byModel: { model: string; cost: number }[]
  byTokenType: {
    input: number
    output: number
    cacheCreation: number
    cacheRead: number
  }
  tokenTrend: { date: string; input: number; output: number; cacheCreation: number; cacheRead: number }[]
  costPerSession: number
}

export interface CacheData {
  orgCacheHitRate: number
  savings: number
  byTeam: { teamId: string; teamName: string; rate: number }[]
  trend: { date: string; rate: number }[]
}

export interface BudgetData {
  monthlyBudget: number
  currentSpend: number
  projected: number
  percentUsed: number
  thresholds: number[]
  teamBudgets: { teamId: string; teamName: string; budget: number; spent: number }[]
}

export interface Team {
  id: string
  name: string
  sessions: number
  cost: number
  completionRate: number
  costPerSession: number
  cacheHitRate: number
  trend: number[]
}

export interface TeamUser {
  id: string
  email: string
  sessions: number
  cost: number
  completionRate: number
  costPerSession: number
  lastActive: string
}

export interface TopFile {
  path: string
  count: number
  sessions: number
  cost?: number
  churn?: number
}

export interface Insight {
  type: 'highCostTeam' | 'lowCacheRate' | 'expensiveSession'
  title: string
  description: string
  severity: 'warning' | 'error' | 'info'
  link: string
}

export interface QualityTier1 {
  sessionSuccessRate: number
  errorsByCategory: Record<string, number>
  toolErrorRate: number
  retryableRecoveryRate: number
}

export interface AlertConfig {
  monthlyBudget: number
  thresholds: number[]
}

export interface LiveUpdate {
  totalSessions: number
  totalCost: number
  completionRate: number
  activeUsers: number
  costPerSession: number
  sessionsTrend: { date: string; sessions: number }[]
  costTrend: { date: string; cost: number }[]
}

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'custom'
export type ModelTier = 'haiku' | 'sonnet' | 'opus'
```

---

## 5. Dev Tooling

### Package Manager
- **pnpm** — workspace-based monorepo

### Formatter / Linter
- **oxlint** (from oxc) — fast Rust-based linter, replaces ESLint for basic rules
- Configured at workspace root via `oxlint.json`

### TypeScript
- `tsconfig.json` at root with path aliases
- Per-package `tsconfig.json` extending root

### Scripts

```json
// Root package.json
{
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "dev:backend": "pnpm --filter backend dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "build": "pnpm -r build",
    "lint": "oxlint .",
    "format": "oxlint --fix .",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter e2e test"
  }
}
```

---

## 6. Port Assignments

| Service | Port | URL |
|---|---|---|
| Backend (Hono) | 3001 | `http://localhost:3001` |
| Frontend (Vite) | 5173 | `http://localhost:5173` |
| Frontend proxies `/api/*` → Backend | — | Transparent |

---

## 7. Deployment (Future)

Not in MVP scope, but the architecture supports:
- Backend: any Node.js host (Fly.io, Railway, Docker)
- Frontend: static build (`vite build`) → any CDN (Vercel, Cloudflare Pages)
- Or single server: backend serves the frontend's `dist/` as static files
