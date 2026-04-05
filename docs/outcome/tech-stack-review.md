# Tech Stack Review

**Date:** 2026-04-04

---

## Stack Overview

| Layer | Choice | Version | Verdict |
|---|---|---|---|
| Runtime | Node.js | 20.17 | Stable, no issues |
| Frontend | React | 19.1 | Solid. `useDeferredValue`, `startTransition` used for perf |
| State | Reatom | 1000.15.2 | Powerful but rough edges (see below) |
| Routing | reatomRoute | 1000.15.2 | Nested routes work. Search-only modals hit edge cases |
| Styling | Tailwind CSS | 4.1 | Fast, dark theme via CSS variables |
| Charts | Recharts | 2.15 | Works for bar/line/donut. No issues |
| Virtualization | TanStack Virtual | 3.13 | Excellent. 1000 rows at 60fps |
| Backend | Hono | 4.7 | Lightweight, fast. SSE support built-in |
| Build | Vite | 6.3 | Fast HMR. Occasional stale module cache on renames |
| Testing | Vitest + Playwright | 3.1 / 1.59 | Fast unit tests, reliable e2e |
| Linting | oxlint | 1.58 | Fast (18ms), but native binding install issues |
| Types | TypeScript | 5.8 | Strict mode. Module augmentation for RouteChild |
| Monorepo | pnpm workspaces | — | Simple, works. Shared types via workspace package |
| DB Client | pg + zapatos | 8.20 / 6.6 | Type-safe PG queries, schema-generated types |
| Simulator | Rust + sqlx | 1.90 / 0.8 | Streaming event generator, embedded migrations |
| Queue | Kafka (rdkafka) | 0.36 | Optional — `poll` mode bypasses it entirely |
| Raw Storage | TimescaleDB | pg16 | Hypertable for time-series agent events |
| Baked Storage | PostgreSQL | 16 | Pre-aggregated tables, one per API endpoint |
| Dev Environment | Devbox | — | Reproducible: Node, pnpm, Rust, cmake, librdkafka |

---

## Reatom v1000: Detailed Review

### Strengths
- **Computed atoms** — granular reactivity, only re-render what changed. Budget update re-renders budget display, not 1000-row grid.
- **`reatomRoute`** — unified state + routing. Routes own loaders (async data fetching), `render()` (component composition), `outlet()` (child route rendering), and `.extend()` (derived state). No separate router library needed.
- **Nested route composition** — parent routes define shared layouts (tabs, headers), child routes render inside via `outlet()`. Route hierarchy mirrors URL hierarchy naturally.
- **Search-only modal routes** — `params()` function enables URL-driven modals without additional libraries. Open modal = navigate, close = navigate back.
- **`reatomComponent`** — wraps React components to subscribe to atoms. Only subscribes to atoms actually read in the render function.
- **`wrap()`** — preserves async context for abort/cleanup. Navigate away mid-fetch → request auto-aborted.
- **`isSomeLoaderPending`** — global loading indicator across all routes with zero configuration. Used for the progress bar.
- **`.extend()` composability** — add computed state, actions, and child routes to any route without modifying the original definition. Budget computed, team users, alert state — all added via extend.
- **Factory pattern** — `create*` prefix for reusable atom patterns. Consistent naming across the codebase.
- **SSE integration** — live override atoms cleanly separate streaming state from loader state. No infinite recomputation loops. Different update rates per UI layer (KPIs every frame, charts every frame, grid throttled).
- **`reatomBoolean`** — one-liner for toggle atoms with `setTrue()`, `setFalse()`, `toggle()`.
- **Action composition** — actions can call other actions, read atoms, and perform async work. Budget save → validate → persist → toast → close modal — all in one action chain.

### Recommendation
Reatom v1000 is the right choice for dashboard applications. The reactive model eliminates unnecessary re-renders, the route-driven architecture keeps pages self-contained, and the computed atom pattern scales well from 5 KPI cards to 1000-row grids.

---

## React 19 Usage

| Feature | Where Used |
|---|---|
| `useDeferredValue` | Evaluated for grid deferred rendering (not used — `DeferredMount` preferred) |
| `startTransition` | `DeferredMount` component — defers heavy grid mount |
| `useRef` | Virtualizer scroll container |
| `useState` | Local UI state (tab expand, FPS counter) |
| `memo` | `CoinsIcon` component |

### Not Used
- `use()` hook — not needed, reatom handles async
- `Suspense` — not compatible with reatom's loading model
- Server Components — client-only SPA

---

## Tailwind CSS 4.1

| Aspect | Notes |
|---|---|
| Dark theme | CSS custom properties (`--color-*`) in `@theme` block |
| Grid layouts | `gridTemplateColumns` for virtualized rows |
| Animations | CSS `@keyframes` for fold, flash, progress bar |
| `scrollbar-gutter` | Evaluated, removed — caused alignment issues |
| `table-fixed` | Used in DataTable for consistent column widths |
| `contents` / `hidden` | Toggle for keeping mounted components visible/hidden |

---

## Build & Test Pipeline

```
pnpm check:all
├── pnpm lint          → oxlint (18ms, 87 files)
├── pnpm typecheck     → tsc --noEmit (frontend + backend)
├── pnpm test          → vitest run (frontend: 134 tests, backend: 84 tests)
└── pnpm test:e2e      → playwright (45 tests, chromium)
```

**Total check time:** ~3 minutes (dominated by e2e)

---

## Dependencies Audit

### Frontend: 12 runtime deps
- `@reatom/*` (3 packages) — state management
- `react`, `react-dom` — UI
- `recharts` — charts
- `@tanstack/react-virtual` — virtualization
- `hono` — API types (not runtime)
- `zod` — validation schemas
- `@number-flow/react` — animated number transitions (installed but removed from use — candidate for cleanup)
- `@zendash/shared` — shared types

### Backend: 5 runtime deps
- `hono` — HTTP framework
- `@hono/node-server` — Node.js adapter
- `pg` — PostgreSQL client
- `zapatos` — Type-safe PostgreSQL queries (schema-generated types)
- `@types/pg` — TypeScript definitions for pg

### Rust Simulator: key crates
- `sqlx` — async PostgreSQL with compile-time checked queries + embedded migrations
- `rdkafka` — Kafka producer/consumer (optional, behind `kafka` feature flag)
- `tokio` — async runtime
- `clap` — CLI subcommands
- `serde` / `serde_json` — serialization
- `chrono` — timestamps
- `rust_decimal` — precise cost calculations (matches TypeScript pricing exactly)

### Infrastructure
- `TimescaleDB` (latest-pg16) — time-series hypertable for raw streaming events
- `PostgreSQL` (16) — pre-aggregated baked tables, one per API endpoint
- `Kafka` (Confluent 7.6) — event queue between simulator and transformer
- `Devbox` — reproducible dev environment (Node, pnpm, Rust, cmake, librdkafka)

**Assessment:** Minimal dependency surface. `@number-flow/react` should be removed from frontend (caused FPS issues with 1000 rows, replaced with plain text).
