# Test Cases: ZenDash MVP

**Runner:** Vitest
**Strategy:** See [testing-strategy.md](./testing-strategy.md)
**Date:** 2026-04-03

---

## Unit Tests: Backend API Handlers

### API-1: GET /api/sessions/summary

| # | Test | Assert |
|---|---|---|
| 1.1 | Returns 200 with default params | `{ totalSessions, completionRate, activeUsers, adoptionRate, costPerSession }` all present |
| 1.2 | `totalSessions` is a positive integer | `typeof body.totalSessions === 'number'` |
| 1.3 | `completionRate` is between 0 and 1 | `0 <= body.completionRate <= 1` |
| 1.4 | Filters by `range=7d` | `totalSessions` is less than or equal to `range=30d` count |
| 1.5 | Filters by `team_id` | Result scoped to team; cross-check with known fixture |
| 1.6 | Filters by `user_id` | Result scoped to user |
| 1.7 | Filters by `model` | Only sessions using that model counted |
| 1.8 | Combined filters work | `team_id=backend&model=opus` returns subset |
| 1.9 | Invalid range returns 400 | `range=invalid` → status 400 |
| 1.10 | Empty result for nonexistent team | `team_id=nonexistent` → `totalSessions: 0` |

### API-2: GET /api/costs/breakdown

| # | Test | Assert |
|---|---|---|
| 2.1 | Returns 200 with cost breakdown object | Has `byTeam`, `byUser`, `byModel`, `byTokenType` |
| 2.2 | `byTokenType` has 4 keys | `input`, `output`, `cacheCreation`, `cacheRead` |
| 2.3 | All costs are non-negative numbers | Every value `>= 0` |
| 2.4 | Sum of `byTeam` equals total | `sum(byTeam.values) === total` |
| 2.5 | Sum of `byTokenType` equals total | `input + output + cacheCreation + cacheRead === total` |
| 2.6 | `range=30d` filter works | Total differs from `range=7d` |
| 2.7 | `team_id` filter scopes to one team | `byTeam` contains only the specified team |
| 2.8 | `costPerSession` = total / completedSessions | Math checks out within rounding tolerance |

### API-3: GET /api/costs/cache

| # | Test | Assert |
|---|---|---|
| 3.1 | Returns 200 with cache data | Has `orgCacheHitRate`, `byTeam`, `savings`, `trend` |
| 3.2 | `orgCacheHitRate` is between 0 and 1 | `0 <= rate <= 1` |
| 3.3 | `savings` is non-negative USD | `savings >= 0` |
| 3.4 | `byTeam` entries have `teamId`, `rate`, `teamName` | Shape check |
| 3.5 | `trend` is array of `{ date, rate }` | Array length > 0, each has date + rate |
| 3.6 | Cache hit rate formula is correct | `cacheRead / (cacheRead + input)` matches reported rate |

### API-4: GET /api/costs/budget

| # | Test | Assert |
|---|---|---|
| 4.1 | Returns 200 with budget data | Has `monthlyBudget`, `currentSpend`, `projected`, `thresholds` |
| 4.2 | `currentSpend <= monthlyBudget` (or over-budget flagged) | Either under or `overBudget: true` |
| 4.3 | `projected` is extrapolated from current spend | `projected >= currentSpend` |
| 4.4 | `thresholds` is array of active alert levels | Array of numbers (50, 75, 90, 100) |

### API-5: GET /api/teams

| # | Test | Assert |
|---|---|---|
| 5.1 | Returns 200 with array of teams | Array length matches fixture (6 teams) |
| 5.2 | Each team has required fields | `id`, `name`, `sessions`, `cost`, `completionRate`, `costPerSession`, `cacheHitRate` |
| 5.3 | Teams are sortable by cost | Default order or specified sort works |
| 5.4 | `range` filter changes values | 7d values <= 30d values |

### API-6: GET /api/teams/:id/users

| # | Test | Assert |
|---|---|---|
| 6.1 | Returns 200 with array of users | Array length > 0 for known team |
| 6.2 | Each user has required fields | `id`, `email`, `sessions`, `cost`, `completionRate`, `costPerSession`, `lastActive` |
| 6.3 | Users belong to the specified team | All user IDs in fixture's team membership |
| 6.4 | Unknown team returns 404 | `team_id=nonexistent` → 404 |
| 6.5 | `lastActive` is a valid ISO date string | Parseable by `new Date()` |

### API-7: GET /api/files/top

| # | Test | Assert |
|---|---|---|
| 7.1 | Returns 200 with `mostRead` and `mostEdited` | Both arrays present |
| 7.2 | Each file has `path`, `count`, `sessions`, `cost` or `churn` | Shape check |
| 7.3 | Arrays are sorted descending by count | `arr[0].count >= arr[1].count` |
| 7.4 | Max 10 items per array | `mostRead.length <= 10` |

### API-8: GET /api/insights

| # | Test | Assert |
|---|---|---|
| 8.1 | Returns 200 with array of up to 3 insights | `1 <= insights.length <= 3` |
| 8.2 | Each insight has `type`, `title`, `description`, `link` | Shape check |
| 8.3 | Insight types are valid | `type` in `['highCostTeam', 'lowCacheRate', 'expensiveSession']` |

### API-9: GET /api/quality/tier1

| # | Test | Assert |
|---|---|---|
| 9.1 | Returns 200 with quality metrics | Has `sessionSuccessRate`, `errorsByCategory`, `toolErrorRate` |
| 9.2 | `sessionSuccessRate` between 0 and 1 | Percentage check |
| 9.3 | `errorsByCategory` has known categories | Keys include `api`, `tool`, `permission`, `runtime` |
| 9.4 | All rates are non-negative | No negative values |

### API-10: POST /api/alerts

| # | Test | Assert |
|---|---|---|
| 10.1 | Creates budget alert — returns 200 | Valid payload accepted |
| 10.2 | Rejects negative budget — returns 400 | `monthlyBudget: -100` → 400 |
| 10.3 | Rejects empty thresholds array | `thresholds: []` → 400 |
| 10.4 | Rejects invalid threshold values | `thresholds: [150]` → 400 (must be 0-100) |
| 10.5 | Persists budget — GET /api/costs/budget reflects change | POST then GET, values match |

### API-11: GET /api/overview/live (SSE)

| # | Test | Assert |
|---|---|---|
| 11.1 | Returns `content-type: text/event-stream` | Header check |
| 11.2 | Streams at least one event within 10 seconds | Read first event from stream |
| 11.3 | Events are valid JSON | `JSON.parse(event.data)` does not throw |
| 11.4 | Event data has KPI fields | `totalSessions`, `totalCost`, `completionRate` present |
| 11.5 | Accepts filter query params | `?range=7d&team_id=backend` — no error |

---

## Unit Tests: Reatom State (Frontend)

### State-1: Filter Atoms

| # | Test | Assert |
|---|---|---|
| 1.1 | `timeRange` defaults to `'30d'` | `timeRange() === '30d'` |
| 1.2 | `teamFilter` defaults to `''` (empty = all) | `teamFilter() === ''` |
| 1.3 | `filterParams` computed includes only non-empty filters | Set `teamFilter('backend')` → params has `team_id`, no `user_id` |
| 1.4 | `filterParams` includes `range` for preset ranges | `timeRange` = '7d' → `params.range === '7d'` |
| 1.5 | `filterParams` includes `from`/`to` for custom range | `timeRange` = 'custom', `dateFrom` = '2026-03-01' → `params.from` set |
| 1.6 | Changing filter triggers computed re-evaluation | Subscribe to `filterParams`, change `teamFilter`, `notify()`, mock called twice |
| 1.7 | Multiple filter changes produce combined params | Set team + model → both present in `filterParams()` |

### State-2: Overview Live Mode

| # | Test | Assert |
|---|---|---|
| 2.1 | `isLive` defaults to false | `isLive() === false` |
| 2.2 | `isLive.setTrue()` changes to true | `isLive() === true` |
| 2.3 | `isLive.toggle()` flips state | false → true → false |
| 2.4 | `overviewData` reads from loader when not live | `isLive() === false` → reads `overviewRoute.loader.data()` |
| 2.5 | `overviewData` reads from `liveData` when live | `isLive() === true`, `liveData.set(mockData)` → `overviewData() === mockData` |

### State-3: Cost Computations

| # | Test | Assert |
|---|---|---|
| 3.1 | Cache hit rate formula is correct | `cacheRead / (cacheRead + input)` |
| 3.2 | Cache savings computed correctly | `cacheRead * (inputPrice - cacheReadPrice)` |
| 3.3 | Total cost = sum of all token type costs | `input*p1 + output*p2 + cacheCreate*p3 + cacheRead*p4` |
| 3.4 | Cost per session = total / completed sessions | Division with zero-guard |
| 3.5 | Budget percentage = currentSpend / monthlyBudget | `4231 / 6000 ≈ 0.705` |

### State-4: Team Data

| # | Test | Assert |
|---|---|---|
| 4.1 | Team list is sorted by cost descending by default | `teams[0].cost >= teams[1].cost` |
| 4.2 | Team detail loader receives `teamId` param | Mock API called with correct ID |
| 4.3 | User table data matches team scope | All users in result belong to selected team |

### State-5: Settings Form

| # | Test | Assert |
|---|---|---|
| 5.1 | `budgetForm` initial values from loader | `fields.monthlyBudget() === '6000'` |
| 5.2 | Validation rejects non-numeric budget | Set `monthlyBudget` to 'abc' → validation error |
| 5.3 | Validation rejects negative budget | Set to '-100' → validation error |
| 5.4 | Validation accepts valid budget | Set to '5000' → no error |
| 5.5 | Submit calls API with correct payload | Mock fetch, submit, assert call args |
| 5.6 | Submit error is captured | Mock fetch to reject → `submit.error()` is set |
| 5.7 | Submit loading state works | `submit.ready()` false during flight, true after |

### State-6: CSV Export

| # | Test | Assert |
|---|---|---|
| 6.1 | `exportCsv` action calls fetch with correct URL | URL includes current view + filter params |
| 6.2 | `exportCsv` creates and clicks download link | Mock `URL.createObjectURL`, assert `a.click()` |
| 6.3 | `exportCsv.ready()` is false during download | Loading state check |
| 6.4 | Filename includes view name and date | Pattern: `zendash-{view}-{YYYY-MM-DD}.csv` |

### State-7: Async Data (withAsyncData patterns)

| # | Test | Assert |
|---|---|---|
| 7.1 | Loader starts as not ready | `route.loader.ready() === false` before subscribe |
| 7.2 | Loader becomes ready after fetch | `await wrap(sleep())` → `ready() === true` |
| 7.3 | Loader data matches API response | `data()` equals mock response |
| 7.4 | Loader error set on fetch failure | Mock reject → `error()` instanceof Error |
| 7.5 | Loader retry re-fetches | Call `retry()`, assert fetch called again |
| 7.6 | Loader abort on navigation | Start fetch, navigate away, assert no state update |

---

## Component Tests (linkedom)

### Comp-1: KPI Card

| # | Test | Assert |
|---|---|---|
| 1.1 | Renders label text | `getByText('TOTAL SESSIONS')` |
| 1.2 | Renders formatted value | `getByText('12,847')` |
| 1.3 | Renders positive delta in green | Delta element has success color class |
| 1.4 | Renders negative delta in red | Delta element has error color class |
| 1.5 | Renders neutral delta in muted color | 0% change → muted styling |

### Comp-2: Overview Page

| # | Test | Assert |
|---|---|---|
| 2.1 | Renders 5 KPI cards | 5 elements with `data-testid="kpi-card"` |
| 2.2 | Renders session chart | `getByText('Sessions Over Time')` |
| 2.3 | Renders cost chart | `getByText('Cost Over Time')` |
| 2.4 | Renders insights panel with up to 3 items | 1-3 insight cards |
| 2.5 | Renders team leaderboard table | Table with team rows |
| 2.6 | Shows skeleton when loading | When `loader.ready() === false`, skeleton rendered |
| 2.7 | Go Live button shows "Go Live" by default | Button text check |
| 2.8 | Go Live button shows "Stop Live" when active | Set `isLive.setTrue()`, re-render, text check |

### Comp-3: Cost Page

| # | Test | Assert |
|---|---|---|
| 3.1 | Renders 4 summary cards | Total Spend, Input, Output, Cache Reads |
| 3.2 | Cache savings badge shows correct value | `getByText('Saved $1,269')` |
| 3.3 | Budget tracker shows progress bar | Progress element present with correct width% |
| 3.4 | Budget tracker shows projected spend | `getByText(/Projected/)` |
| 3.5 | Top files tables render | "Most-Read Files" and "Most-Edited Files" headings |
| 3.6 | File paths render in monospace | File path elements have mono class |
| 3.7 | Token breakdown toggle buttons present | "By Team", "By Model", "By User" |

### Comp-4: Teams Page

| # | Test | Assert |
|---|---|---|
| 4.1 | All teams grid renders with virtualized rows | Visible rows present, total height matches team count × row height |
| 4.2 | Grid headers present | TEAM, SESSIONS, COMPLETION, SPENT/BUDGET, COST/SESS, CACHE |
| 4.3 | Team tabs render | "All Teams" button + team name buttons visible |
| 4.4 | Clicking team tab navigates to detail | URL changes to `/teams/:teamId` |
| 4.5 | Team detail shows 4 KPI cards | Sessions, Completion, Cost/Session, Cache Hit |
| 4.6 | Budget inline shows spent/budget in header | `$0.49 / $1.00` format next to team name |
| 4.7 | Clicking coins icon opens edit modal | Modal with budget input visible |
| 4.8 | Edit modal URL is `/teams/:teamId?edit` | Search param check |
| 4.9 | User table renders team members | Table with user rows, emails visible |
| 4.10 | Coins icon opens org budget modal on all-teams page | Modal with budget input at `/teams?edit` |

### Comp-5: Alerts Page

| # | Test | Assert |
|---|---|---|
| 5.1 | Alert thresholds render | 4 toggles for 50/75/90/100% |
| 5.2 | Alert delivery toggles render | Email and in-app notification toggles |
| 5.3 | Anomaly detection toggle renders | Enabled toggle with description |
| 5.4 | Alert history shows clickable items | Items with date, text, navigation arrow |
| 5.5 | Clicking alert navigates to relevant page | Team alert → `/teams/:teamId`, cost alert → `/costs` |

### Comp-6: Filter Bar

| # | Test | Assert |
|---|---|---|
| 6.1 | Time range buttons render | 5 buttons: Today, 7d, 30d, 90d, Custom |
| 6.2 | Active time range button is highlighted | 30d button has active class |
| 6.3 | Clicking time range updates atom | Click "7d" → `timeRange() === '7d'` |
| 6.4 | Team dropdown renders | `getByTestId('filter-team')` |
| 6.5 | Selecting team updates atom | Select 'backend' → `teamFilter() === 'backend'` |
| 6.6 | Export CSV button renders | `getByText('Export CSV')` |
| 6.7 | Go Live button only on Overview | Present on Overview, absent on Costs |

### Comp-7: Navigation Sidebar

| # | Test | Assert |
|---|---|---|
| 7.1 | All 4 nav items render | Overview, Costs, Teams, Settings |
| 7.2 | Active route is highlighted | Current route's nav item has active class |
| 7.3 | Clicking nav item navigates | Click "Costs" → `costsRoute.go()` called |
| 7.4 | Logo renders | "ZenDash" text present |

---

## E2E Tests (Playwright)

### E2E-1: Overview Journey

| # | Test | Steps | Assert |
|---|---|---|---|
| 1.1 | Dashboard loads | Navigate to `/` | 5 KPI cards visible, no error |
| 1.2 | KPI values are numbers | Load page | Each card value matches `/[\d,.$%]+/` |
| 1.3 | Charts render | Load page | Both chart containers have `<svg>` or `<canvas>` children |
| 1.4 | Insights panel shows items | Load page | 1-3 insight cards with text |
| 1.5 | Team leaderboard shows rows | Load page | Table has >= 1 data row |
| 1.6 | Leaderboard row links to team | Click first team row | URL changes to `/teams/{teamId}` |

### E2E-2: Go Live Mode

| # | Test | Steps | Assert |
|---|---|---|---|
| 2.1 | Go Live button visible | Navigate to `/` | Button with "Go Live" text |
| 2.2 | Clicking activates live mode | Click "Go Live" | Button text changes to "Stop Live" |
| 2.3 | KPIs update automatically | Activate live, wait 10s | At least one KPI value changes |
| 2.4 | Stop Live returns to static | Click "Stop Live" | Button text back to "Go Live" |
| 2.5 | Live mode stops on navigation | Activate live, click "Costs" nav | Return to Overview → button shows "Go Live" |

### E2E-3: Cost Analysis Journey

| # | Test | Steps | Assert |
|---|---|---|---|
| 3.1 | Costs page loads | Click "Costs" nav | 4 summary cards visible |
| 3.2 | Token breakdown chart renders | Load page | Chart container non-empty |
| 3.3 | Cache efficiency gauge shows rate | Load page | Gauge shows percentage |
| 3.4 | Budget tracker shows progress | Load page | Progress bar visible with dollar values |
| 3.5 | Top files tables show data | Load page | Both tables have rows |
| 3.6 | Toggle "By Model" changes chart | Click "By Model" button | Chart updates (different data) |

### E2E-4: Filter Flow

| # | Test | Steps | Assert |
|---|---|---|---|
| 4.1 | Default filter is 30d | Load any page | 30d button is active |
| 4.2 | Changing time range updates data | Click "7d" | KPI values change, URL has `?range=7d` |
| 4.3 | Team filter updates data | Select "Backend" from dropdown | Data scoped to backend |
| 4.4 | Filters persist in URL | Set team=backend, copy URL, navigate away, paste URL | Team filter restored |
| 4.5 | Filters persist across nav | Set team=backend on Overview, click Costs | Costs view filtered to backend |
| 4.6 | Reset filters | Set multiple filters, clear all | All dropdowns back to "All" |

### E2E-5: Team Drill-Down Journey

| # | Test | Steps | Assert |
|---|---|---|---|
| 5.1 | Teams page shows virtualized grid | Click "Teams" nav | Grid with team rows, tabs above |
| 5.2 | Click team row navigates to detail | Click "Backend" row | URL = `/teams/backend`, detail view loads |
| 5.3 | Team detail shows KPI cards | Load team detail | 5 KPI cards including Budget with progress bar |
| 5.4 | Budget card opens edit modal | Click budget card | Modal opens, URL has `?edit` |
| 5.5 | Edit modal saves budget | Change value, click Save | Toast shown, modal closes, `?edit` removed |
| 5.6 | "All Teams" tab returns to grid | Click "All Teams" tab | Grid visible instantly (no remount delay) |
| 5.7 | Org budget edit via coins icon | Click coins icon on all-teams | Modal opens at `/teams?edit` |
| 5.8 | Team tabs show on both pages | Navigate between all/detail | Tabs visible on both views |

### E2E-6: Alerts & Budget Journey

| # | Test | Steps | Assert |
|---|---|---|---|
| 6.1 | Alerts page loads | Click "Alerts" nav | Alert thresholds and history visible |
| 6.2 | Alert thresholds toggleable | Toggle 50% threshold | Toggle state changes |
| 6.3 | Alert history items navigate | Click team alert | Navigates to `/teams/:teamId` |
| 6.4 | Org budget editable from teams | Go to Teams, click coins icon | Modal with budget input opens |
| 6.5 | Save org budget | Change budget, click Save | Toast confirms, modal closes |
| 6.6 | Team budget editable | Go to team detail, click budget card | Modal opens with current budget |

### E2E-7: CSV Export

| # | Test | Steps | Assert |
|---|---|---|---|
| 7.1 | Export button triggers download | Click "Export CSV" on Overview | Download initiated (intercept network) |
| 7.2 | Export respects active filters | Set team=backend, export | Downloaded file scoped to backend |
| 7.3 | Export works on each view | Navigate to Costs, export; Teams, export | Each produces a file |

### E2E-8: Navigation & URL

| # | Test | Steps | Assert |
|---|---|---|---|
| 8.1 | Direct URL to Costs works | Navigate to `/costs` | Costs page loads |
| 8.2 | Direct URL to team detail works | Navigate to `/teams/backend` | Team detail loads |
| 8.3 | Direct URL with filters works | Navigate to `/costs?range=7d&team=backend` | Filters applied, data scoped |
| 8.4 | Unknown URL shows fallback | Navigate to `/nonexistent` | Redirects to Overview or shows 404 |
| 8.5 | Browser back/forward works | Navigate Overview → Costs → Teams → Back | Returns to Costs |

### E2E-9: Performance

| # | Test | Steps | Assert |
|---|---|---|---|
| 9.1 | Initial load under 2 seconds | Navigate to `/`, measure | `performance.timing` < 2000ms |
| 9.2 | Filter response under 500ms | Click filter, measure | Data updates within 500ms |
| 9.3 | Navigation is instant | Click nav item, measure | View renders within 200ms |

### E2E-10: Accessibility

| # | Test | Steps | Assert |
|---|---|---|---|
| 10.1 | All interactive elements keyboard-reachable | Tab through page | Focus reaches all buttons, links, inputs |
| 10.2 | Charts have data table fallback | Check chart containers | `<table>` or `aria-label` present |
| 10.3 | Color contrast sufficient | Axe audit | No critical contrast violations |

---

## Test Count Summary

| Layer | Count | Approx. Runtime |
|---|---|---|
| Unit: Backend API (API-1 through API-11) | 52 | ~5s |
| Unit: Reatom State (State-1 through State-7) | 37 | ~3s |
| Component: UI (Comp-1 through Comp-7) | 38 | ~8s |
| E2E: Playwright (E2E-1 through E2E-10) | 37 | ~60s |
| **Total** | **168** | **~76s** |

---

## Budget Distribution Tests (2026-04-04)

### BD-1: Auto-distribution

| # | Test | Assert |
|---|---|---|
| 1.1 | 6 teams, budget $600, no overrides | Each team gets $100 |
| 1.2 | 6 teams, budget $600, 1 override of $300 | Override team: $300, remaining 5 get $60 each |
| 1.3 | 6 teams, budget $600, 3 overrides totaling $450 | Override teams keep values, remaining 3 get $50 each |
| 1.4 | All teams overridden | Each team gets its override, no auto-distribution |
| 1.5 | Auto budget < $1 | Clamped to $1 |
| 1.6 | Single team, no override | Gets full budget |

### BD-2: Team budget edit — increase

| # | Test | Assert |
|---|---|---|
| 2.1 | Team at $100, user sets $200 | Warning: "increased by $100" |
| 2.2 | Save increased override | Override stored, other auto teams recalculated lower |
| 2.3 | Increase leaves auto teams ≥ $1 | Save succeeds |

### BD-2b: Org budget auto-increase on team override

| # | Test | Assert |
|---|---|---|
| 2b.1 | Team at auto $100 (org $600, 6 teams), set to $200 | Org budget increases to $700 (delta +$100) |
| 2b.2 | Team with prior override $150, set to $300 | Org budget increases by $150 (delta = $300 − $150) |
| 2b.3 | Team decrease from $200 to $100 | Org budget stays unchanged (only grows) |
| 2b.4 | Team set to same value as current | Org budget unchanged (delta = 0) |
| 2b.5 | Multiple sequential increases | Each increase adds its delta to org budget |

### BD-3: Team budget edit — decrease

| # | Test | Assert |
|---|---|---|
| 3.1 | Team at $200, user sets $100 | Info: "decreased by $100, redistributed" |
| 3.2 | Save decreased override | Override stored, other auto teams recalculated higher |

### BD-4: Team budget edit — remove override

| # | Test | Assert |
|---|---|---|
| 4.1 | Clear input | Override removed, team returns to auto |
| 4.2 | Info shows "auto-calculated budget" | UI feedback present |

### BD-5: Org budget — lower than spend

| # | Test | Assert |
|---|---|---|
| 5.1 | Current spend $500, set budget to $400 | Error toast, save blocked |
| 5.2 | Input remains at $400 | User can correct |

### BD-6: Org budget — lower than sum of overrides

| # | Test | Assert |
|---|---|---|
| 6.1 | Overrides sum $500, set budget to $400 | Yellow warning with team list |
| 6.2 | Warning lists 6 most expensive | Format: "TeamA ($X→$Y), ..." |
| 6.3 | More than 6 overrides shows "and N more" | Truncated list |
| 6.4 | Save shrinks overrides proportionally | Each: `override * (400/500)` |
| 6.5 | Shrunk override below $1 clamped to $1 | Minimum enforced |
| 6.6 | Shrunk overrides saved to localStorage | Persisted |

### BD-7: Org budget — zero or negative

| # | Test | Assert |
|---|---|---|
| 7.1 | Set budget to 0 | Error toast, save blocked |
| 7.2 | Set budget to -100 | Error toast, save blocked |

### BD-8: Edge cases

| # | Test | Assert |
|---|---|---|
| 8.1 | All teams overridden, budget shrink | All overrides shrunk proportionally |
| 8.2 | Budget increase after shrink | Overrides stay shrunk, auto teams benefit |
| 8.3 | Override equals auto budget | Override stored, value doesn't change visually |

### BD-9: Alert history generation

Alert history is generated server-side from actual session costs vs budget config.

**Three alert types:**
1. `threshold_reached` — org total spend crossed a configured threshold (50%, 75%, 90%, 100%)
2. `budget_exceeded` — a team's spend exceeds its allocated budget (override or auto-distributed)
3. `spend_spike` — a team's daily cost is >2× its 7-day daily average

| # | Test | Assert |
|---|---|---|
| 9.1 | Threshold alert fires when spend > threshold × budget | Budget $1000, threshold 50%, spend $600 → alert with `type: 'threshold_reached'` |
| 9.2 | Threshold severity: 100% = error, 90% = warning, else info | Check severity for each threshold level |
| 9.3 | No threshold alert when spend below threshold | Budget $1000, threshold 90%, spend $100 → no 90% alert |
| 9.4 | Team budget exceeded with auto-distribution | Budget $300, 3 teams, no overrides → $100/team. Team A spends $150 → `budget_exceeded` alert |
| 9.5 | Team budget exceeded with override | Budget $300, team A override $50. Team A spends $80 → `budget_exceeded` for A |
| 9.6 | Team within budget → no alert | Team A spends $40, budget $100 → no `budget_exceeded` for A |
| 9.7 | Override changes budget allocation | Budget $300, 3 teams. Override team A to $200 → B,C get $50 each. B spends $60 → `budget_exceeded` for B |
| 9.8 | Spend spike when daily > 2× weekly avg | Team daily $10, weekly avg $4/day → `spend_spike` alert |
| 9.9 | No spike when daily within normal range | Team daily $5, weekly avg $4/day → no spike alert |
| 9.10 | Alert `teamId` is set for team alerts, null for org alerts | threshold_reached → `teamId: null`, budget_exceeded → `teamId: 'team-a'` |
| 9.11 | Alerts sorted by timestamp descending | First alert is most recent |
| 9.12 | Max 25 alerts returned | Even with many triggers, capped at 25 |

### BD-10: Org budget edit modal

| # | Test | Assert |
|---|---|---|
| 10.1 | Opens at `/teams?edit` | URL has `?edit` search param |
| 10.2 | Pre-fills current budget value | Input shows current org budget |
| 10.3 | Save updates budget atom and calls API | Budget persisted |
| 10.4 | Close removes `?edit` from URL | URL returns to `/teams` |

---

## Test Data Dependencies

All tests use the shared fixture set from [MVP Scope Section 5.2](./mvp-scope.md):

| Fixture | Content | Used by |
|---|---|---|
| `sessions.json` | 3,000 sessions, 30 days | API tests, state tests |
| `teams.json` | 6 teams with IDs | API tests, component tests |
| `users.json` | 50 users mapped to teams | API tests, component tests |
| `pricing.json` | Haiku/Sonnet/Opus rates | Cost computation tests |

Backend serves fixtures as mock data. Frontend unit tests import fixtures directly for assertions.
