# ZenDash MVP: Project Summary

**Date:** 2026-04-04
**Branch:** `reatom-big-table`
**Commits:** 17 (382aa92..004b626)

---

## What We Built

Agent analytics dashboard for engineering leaders to monitor AI coding assistant costs, attribute spend to teams, and control budgets.

**4 views:** Overview (live KPIs + SSE), Cost & Usage (token breakdown, cache efficiency), Teams (1000-team virtualized grid with budget editing), Alerts (threshold config + generated alert history).

**Key numbers:**
- 6,100 lines of source code (frontend + backend)
- 39 React components, 23 page/route files
- 222 test cases (134 unit + 13 alert + 15 budget + 45 e2e + 15 budget-integration)
- 0 lint warnings, 0 type errors
- 1000 teams rendered at 60fps with virtualization

---

## Evolution: Commit by Commit

### Phase 1: Foundation (382aa92 → c6717d0)

| Commit | What | Decision |
|---|---|---|
| 382aa92 | Initial setup | CLAUDE.md, docs structure, monorepo with pnpm workspaces |
| b57693c | Core application | Hono backend with mock data generator, React frontend with Reatom state, 4 views, dark theme |
| 2e6c877 | Component tests | 45 component tests with linkedom (no browser needed) |
| c6717d0 | E2E tests | Playwright e2e covering all user journeys |

**Hypothesis:** Start with mock data at realistic scale (6 teams, 50 users, 3000 sessions) to validate the dashboard patterns before connecting real APIs.

### Phase 2: Scale Testing (2fe6c66 → 7ba7748)

| Commit | What | Decision |
|---|---|---|
| 2fe6c66 | Extended tests | Additional API and state management tests |
| 94e4d68 | Scale experiment | Increased to 1000 teams — tested rendering approaches |
| 3b94b63 | FPS counter | Added FPS counter to measure rendering performance |
| 7ba7748 | Virtualization | @tanstack/react-virtual for 1000-row grid at 60fps |

**Hypothesis:** React alone can't handle 1000 live-updating rows. Explored 5 approaches:
1. Plain React (50fps drop at 1000 rows)
2. Atomized per-row models (froze browser — too many subscriptions)
3. Imperative DOM patches (worked but messy, React overwrites)
4. Reatom JSX (`@reatom/jsx` — setup issues with dual JSX)
5. **Virtualization (winner)** — only render visible rows, CSS Grid for alignment

**Key finding:** The bottleneck isn't rendering — it's mounting. 1000 `reatomComponent` wrappers create 1000 atom subscriptions. Solution: one `reatomComponent` parent reads shared state, passes plain props to function rows.

### Phase 3: Architecture (d6a6c19 → f83b003)

| Commit | What | Decision |
|---|---|---|
| d6a6c19 | Reatom patterns doc | 11 patterns for live-updating dashboards |
| eb67999 | Reatom JSX experiment | Tried `.reatom.tsx` files with custom Vite plugin |
| e78565e | JSX fixes | `@jsxImportSource` conflict resolution |
| c202523 | Wrapper fixes | Fixed `reatomComponent` wrapping requirements |
| 703c461 | Major rename | `features/` → `pages/` structure |
| f83b003 | Routing refactor | `reatomRoute` with nested routes, loaders, `render()` |

**Hypothesis:** Route definitions should own their data loading (loaders), component rendering (`render()`), and derived state (`.extend()`). This keeps each page self-contained.

**Decision: `pages/` over `features/`**
- Each page folder: `*-route.ts` (route + model) + `*-page.tsx` (component) + `components/`
- Routes compose via parent `render()` + `outlet()` for shared layouts (tabs)
- Search-only routes for modals (`?edit`, `?editTeam=:id`)

### Phase 4: Budget System (5e9c6ae → e80d183)

| Commit | What | Decision |
|---|---|---|
| 5e9c6ae | Route-based architecture | All routes use `reatomRoute` with loaders |
| e80d183 | Budget distribution | Pure functions for budget allocation + 24 unit tests |

**Decisions:**
- Budget stored server-side (`POST /api/budgets`), not localStorage
- Auto-distribution: remaining budget / non-overridden teams (min $1)
- Proportional shrinking when org budget < override sum
- Validation prevents saving below current spend
- Two separate edit routes: `editAllTeamRoute` (from grid) + `editTeamRoute` (from detail)

### Phase 5: Polish (004b626)

| What | Detail |
|---|---|
| Alert history | Server-generated from session data vs budget config (3 types: threshold, exceeded, spike) |
| Global progress bar | `isSomeLoaderPending` + 500ms delay |
| Deferred mount | `startTransition` for instant tab switching |
| Sticky tabs | Team tabs stay visible on scroll |
| 0 warnings, 0 type errors | Clean lint + typecheck |
| E2E healed | 45 Playwright tests passing |

---

## Key Technical Decisions

### 1. Reatom v1000 over React Query / Zustand

**Why:** Route-driven architecture with computed atoms, SSE support, and granular reactivity. One atom change re-renders one component, not the whole tree.

**Advantages realized:**
- **Unified state + routing** — routes own their loaders, computed state, and render functions. No separate router library needed.
- **Granular subscriptions** — `reatomComponent` subscribes only to atoms it reads. Budget change re-renders budget display, not the entire grid.
- **Built-in async** — `wrap()` preserves abort context, `withAsyncData` handles loading/error/data lifecycle automatically.
- **Composable architecture** — `.extend()` adds derived state to any route without touching the original definition. Factory pattern (`create*`) enables reusable atom patterns.
- **SSE integration** — live override atoms cleanly separate SSE state from loader state, preventing infinite recomputation loops.
- **`isSomeLoaderPending`** — global loading indicator across all routes with zero configuration.

### 2. Search-Only Modal Routes

**Pattern:** Modals open via URL search params (`?editTeam=backend`), close by removing them. Routes with `params` function validate search params — return object to match (modal open), `null` to reject (modal closed).

**Documented in:** `docs/mvp/reatom-patterns.md` section 10.

### 3. CSS Grid over `<table>` for Virtualized Lists

**Why:** Absolute-positioned virtual rows can't participate in `<table>` column layout. CSS Grid with shared `gridTemplateColumns` keeps header and body aligned.

### 4. `contents` / `hidden` for Instant Tab Switching

**Problem:** Mounting `AllTeamsContent` (1000-row virtualizer) takes ~700ms.
**Solution:** Keep it mounted, toggle `display: contents` (visible) vs `display: none` (hidden). Switching back is instant — no remount.

### 5. Server-Side Budget Storage

**Before:** localStorage on client, synced to API on save.
**After:** `POST /api/budgets` is the single source of truth. Budget state broadcast via SSE on every change.

**Why:** Prevents stale state across tabs, makes alerts API self-contained (reads budget from store, not client).

### 6. `createLiveMode<T>()` Factory (Stage 1)

Reusable factory for SSE connections: `{ url, name }` → `{ data, isLive, start, stop }`. Used by overview (real + turbo) and teams (budget). Auto-connects via `withChangeHook` on route match.

### 7. Server-Side Budget Expansion (Stage 1)

Budget logic moved to pure `computeUpdatedBudget()` on the server. When a team override increases, the org budget auto-expands. Validation rejects budget below override sum. Single `POST /api/budgets/team` endpoint — frontend sends `{ teamId, budget }`, server reads current config, merges, expands, saves, broadcasts.

### 8. Route Decoupling (Stage 1)

Teams monolith (`teams-route.tsx`, 250 lines) split into 8 files across 5 folders:
- `teams-route.tsx` — layout, teamsList, budget SSE hook
- `all-teams/` — grid page, budget view
- `team/` — detail page with own budget fetch
- `edit-budget/` — org budget modal (`/teams?edit`)
- `edit-team-budget/` — team budget modal (`/teams/:id?edit=true`)
- `edit-grid-team-budget/` — team budget from grid (`/teams?editTeam=:id`)

Each route owns its data. No shared mutable budget atom — server is the source of truth, SSE keeps clients in sync.

---

## Current Metrics

| Metric | Value |
|---|---|
| TypeScript source lines | ~8,600 |
| Rust source lines | ~1,800 |
| React components | 42 |
| TS tests (backend) | 94 |
| TS tests (frontend) | 139 |
| Rust tests | 54 |
| E2E tests (Playwright) | 39 |
| **Total tests** | **326** |
| SQL migrations | 10 |
| Lint warnings | 0 |
| Type errors | 0 |
| Teams rendered | 1000 at 60fps |
| SSE (real data) | polls every 5s |
| SSE (turbo mode) | 15 updates/sec |
| Docker services | 5 |
| Poll rate | ~900 sessions / 30s |

---

## What Could Be Improved

### Performance
- **Server-side pagination** instead of loading all 1000 teams at once
- **Web Worker** for budget distribution computation on large team sets
- **Memo** the `TeamTabs` component — re-renders on every team list change

### Architecture
- **Type-safe API client** — replace manual `api.` object with Hono RPC client types
- **Route-level code splitting** — lazy load page components per route
- **Error boundaries** per route — currently errors crash the whole app

### Testing
- **Visual regression tests** for charts and grid layouts
- **Load testing** the SSE endpoint with concurrent connections
- **Budget distribution property tests** (fast-check) for edge cases

### UX
- **Search/filter** within the 1000-team grid
- **Sort columns** by clicking headers
- **Keyboard navigation** in the grid
- **Breadcrumb** on team detail page (instead of "All Teams" tab only)
- **Budget history** — track changes over time, not just current state

---

## Stage 1: Real Data Pipeline (2026-04-05)

Replaced in-memory mock data with a full data pipeline.

### What was built

**Rust simulator** (`services/rust-simulator/`) — single binary with subcommands:
- Generates streaming-level agent events matching the Claw Code reference agent format (SessionStart, TextDelta, ToolUse, ToolResult, Usage, MessageStop, SessionEnd)
- Stores raw events in TimescaleDB hypertable
- Transforms events via Kafka into pre-aggregated PostgreSQL tables
- `poll` command: seeds 3 days + generates ~900 sessions every 30s (no Kafka needed)
- Observation tools: `status`, `verify`, `kafka-monitor`
- 54 Rust tests with deterministic fixtures

**Infrastructure** — Docker Compose with TimescaleDB (5433), PostgreSQL (5432), Kafka (9092), Zookeeper

**Backend rewrite** — all 9 route files rewritten from in-memory mock to PostgreSQL queries using `pg` + `zapatos` for type safety. Mock pool for tests (79 tests still passing).

**Live SSE from real data** — overview page auto-connects to `/api/overview/live` which polls PostgreSQL every 5s. Data updates as the simulator writes new sessions.

**Turbo mode** — `/api/turbo/live` endpoint generates data at 15 updates/sec with no database. "Turbo (No DB)" button on overview for UI stress testing.

**Developer experience** — `devbox.json` for reproducible environment (Node, pnpm, Rust, cmake, librdkafka). Two terminals to run: `cargo run -- poll` + `pnpm dev`.

### Key numbers (Stage 1)

| Metric | Value |
|---|---|
| Rust source lines | ~1,800 |
| Rust tests | 54 |
| SQL migrations | 10 (3 TimescaleDB + 7 PostgreSQL) |
| Backend tests | 79 (mock pool, no DB needed) |
| Docker services | 5 (TimescaleDB, PostgreSQL, Kafka, Zookeeper, Simulator) |
| Events per session | 5–50 (streaming level) |
| Poll rate | ~900 sessions / 30s |

---

## Weak Points

1. ~~**Mock data only**~~ — **Resolved in Stage 1.** Real PostgreSQL persistence, Rust simulator, Kafka pipeline.

2. **No authentication** — anyone can access any endpoint. No org/team scoping.

3. **Alert toggles are visual-only** — email/Slack delivery toggles render but don't connect to any notification system.

4. **CSV export** — button exists but the actual export logic isn't implemented.

5. **No i18n** — all strings hardcoded in English.

6. **`formatCurrency` always shows 2 decimals** — `$0.00 / $6,000.00` is verbose for large numbers.

---

## Next Steps

### Immediate (this sprint)
1. Implement CSV export (data is available, just needs download trigger)
2. Add column sorting to teams grid
3. Add search/filter input above grid
4. Connect alert delivery toggles to actual notification logic

### Short-term (next sprint)
1. Authentication + org scoping
2. Budget history tracking (audit log of changes)
3. Route-level code splitting for faster initial load
4. Connect to real agent telemetry (replace simulator with real events)

### Medium-term (V2)
1. Quality deep-dive view (Tier 2 metrics)
2. Optimization Advisor (AI-powered recommendations)
3. Slack integration for alerts
4. Custom date range picker
5. Per-session drill-down (link to agent task)
