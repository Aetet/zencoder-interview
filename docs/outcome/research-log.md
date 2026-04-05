# Research Log

Investigations, experiments, and findings during MVP development.

---

## R1: Rendering 1000 Live-Updating Rows

**Question:** How to render 1000 team rows that update 2-3x/second via SSE without dropping below 60fps?

**Approaches tested:**

| # | Approach | Result | FPS |
|---|---|---|---|
| 1 | Plain React, 1000 `<tr>` | Works at 100 rows | 3fps at 1000 |
| 2 | Per-row reatom atoms | Froze browser | 0fps |
| 3 | Imperative DOM (`textContent`) | Fast updates, but React overwrites on re-render | 60fps (unstable) |
| 4 | Reatom JSX (`@reatom/jsx`) | Required custom Vite plugin, `jsxImportSource` conflicts | Not viable |
| 5 | **Virtualization** (`@tanstack/react-virtual`) | Only renders ~20 visible rows | **60fps** |

**Finding:** The bottleneck is React component mount cost, not DOM updates. Virtualizing to ~20 visible rows eliminates the problem. CSS Grid (not `<table>`) required for absolute-positioned virtual rows.

**Finding:** `reatomComponent` per row creates N atom subscriptions. Reading shared state once in the parent and passing as props avoids this.

---

## R2: NumberFlow Performance

**Question:** Can `@number-flow/react` animate 1000 numbers simultaneously?

**Result:** No. Page froze completely. The library creates per-digit DOM elements with intersection observers. Removed, replaced with plain `toLocaleString()` formatting.

---

## R3: Reatom Route `inputParams` Behavior

**Question:** Why doesn't closing a search-only modal route work when the parent has path params?

**Investigation:** Read reatom source (`route.js` lines 161-232):

1. `go()` calls `inputParams.set(params)` **before** `getPath(params)` (line 163 vs 167)
2. If `getPath` throws (missing `:teamId`), `inputParams` is already set
3. Route computed reads `inputParams` first (line 179), skips URL parsing
4. Navigating via parent route (`teamRoute.go()`) doesn't clear child's `inputParams`
5. Middleware (lines 905-920) auto-clears when route returns `null`, but only on next tick

**Solution:** `edit.inputParams.set(null)` forces URL-based parsing. URL has no `?edit`, route doesn't match.

**Documented in:** `reatom-patterns.md` section 10.

---

## R4: `scrollbar-gutter: stable`

**Question:** How to prevent layout shift when scrollbar appears in virtualized grid?

**Tested:** `scrollbar-gutter: stable` on scroll container. Result: header and body column widths mismatch because header doesn't have the gutter.

**Solution:** Removed `scrollbar-gutter`. Used `overflow-x-hidden` on scroll container. The `1fr` Team column absorbs width differences naturally.

---

## R5: DeferredMount Pattern

**Question:** Teams tab opens slowly (~700ms) because `AllTeamsContent` with virtualizer mounts from scratch.

**Hypothesis A:** `useDeferredValue` on teams list — rejected, doesn't help with mount cost.
**Hypothesis B:** Keep component mounted, toggle with CSS — works, but delays first render.
**Solution:** `DeferredMount` component wraps `AllTeamsContent`. Uses `startTransition` to defer mount. Shows skeleton immediately, renders grid in low-priority pass.

Combined with CSS `hidden`/`contents` toggling: first mount deferred, subsequent switches instant.

---

## R6: Budget Distribution Edge Cases

**Question:** What happens when org budget is lower than the sum of team overrides?

**Research:** Designed proportional shrinking algorithm:
- Each override shrunk by ratio: `newOverride = override * (newBudget / overrideSum)`
- Minimum $1 per team enforced
- UI shows warning listing 6 most expensive teams before save

**Tested with 24 unit tests** covering: auto-distribution, increase, decrease, remove, shrink, zero budget, all-overridden, single team.

---

## R7: Alert History Generation

**Question:** How to generate realistic alert history without a real event system?

**Approach:** Server-side computation on each `GET /api/alerts` request:
1. Compute per-team costs from session data
2. Check threshold crossings (50/75/90/100% of budget)
3. Check per-team budget exceeded (override or auto-distributed)
4. Detect spend spikes (daily cost > 2x 7-day average)
5. Sort by timestamp, cap at 25

**Tested with 13 unit tests** using controlled mock data (not real sessions).

---

## R8: Data Pipeline Architecture

**Question:** How to replace in-memory mock data with a real pipeline that can later accept production agent events?

**Approaches considered:**

| # | Approach | Result |
|---|---|---|
| 1 | Rust API mirrors TypeScript endpoints | Rejected — two services serving same API is redundant |
| 2 | TypeScript queries raw events directly | Rejected — too many aggregations at query time |
| 3 | **Simulator → TimescaleDB → Kafka → Transformer → PostgreSQL → TypeScript** | Chosen |

**Key decisions:**

- **Streaming-level events** (not session-level aggregates) — each `TextDelta`, `ToolUse`, `Usage` is a separate row. Matches real agent output format, enables future session replay.
- **Per-endpoint baked tables** — one PostgreSQL table per API endpoint (`daily_session_summary`, `daily_token_stats`, etc.). TypeScript does `SELECT` with no computation.
- **`poll` mode** — bypasses Kafka, writes directly to both databases. Two terminals to run the whole stack. Designed for fast local development.
- **Turbo SSE endpoint** — generates data at 15 updates/sec with no database connection. Separate from real-live endpoint. Enables UI stress testing without infrastructure.

**Findings:**

- `SUM(active_users)` across `(date, team_id, model)` over-counts users massively. Fixed: `COUNT(DISTINCT user_id)` from `team_user_stats`.
- `block_on` inside tokio panics. Kafka consumer had to be fully async (replaced sync callback with `async_stream` + `StreamExt`).
- `rust:latest` Docker image uses newer glibc than `debian:bookworm-slim` runtime. Fixed: `rust:1-bookworm` for matching glibc.
- Kafka consumer group offsets persist across container restarts. Historical events from a pre-Kafka run are never consumed. Fix: reset consumer group offsets or wipe and re-simulate.

**Tested with 54 Rust tests** using deterministic fixtures (7 session types: completed, errored-tool, errored-api, cancelled, tool-errors-but-completed, opus, haiku). Tests verify token aggregation, cost calculation, tool counting, error classification, event sequence structure, cache behavior pattern.

---

## R9: Mock Pool for Backend Tests

**Question:** Backend tests used to import `store` and `filterSessions()` directly. Routes now query PostgreSQL. How to test without a real database?

**Solution:** Replaceable pool via `setPool()`. Test setup file creates a mock pool that pattern-matches SQL queries and returns deterministic data.

**Challenges:**
- SQL pattern matching is fragile — query text changes break mocks. Mitigated with `has(q, ...terms)` helper that checks for keyword presence, not exact SQL.
- Range filters (`INTERVAL '7 days'`) are embedded as string literals in SQL, not as parameters. Mock detects them via string matching.
- Token-type costs must match `total` exactly — the mock's per-model token counts must produce the same total when pricing is applied.

**Result:** 79 backend tests pass without any database, in <500ms.
