# MVP Scope: Agent Analytics Dashboard

**Date:** 2026-04-03
**Target:** 6-week delivery
**Scale:** Single org, up to 1,000 users, 100,000 sessions/month
**Source:** [Product Requirements v2](../product-requirements.md)

---

## 1. MVP Definition

The MVP proves one hypothesis: **engineering leaders will use (and pay for) a dashboard that attributes AI agent costs to teams with budget controls.**

Everything in the MVP serves this hypothesis. If a feature doesn't help prove it, it's cut.

---

## 2. Views & Layout

The dashboard is a single-page app with a **left sidebar navigation**, **global filter bar** at the top, and a **main content area**. Four views:

| View | Nav Label | Purpose | Priority |
|---|---|---|---|
| Organization Overview | **Overview** | Org-wide snapshot: cost, sessions, adoption, insights | P0 — landing page |
| Cost & Usage | **Costs** | Deep cost analysis: breakdowns, cache efficiency, budgets | P0 — core value prop |
| Team & Users | **Teams** | Per-team and per-user metrics with drill-down | P0 — attribution |
| Settings | **Settings** | Budget thresholds, alert configuration | P1 — enables alerts |

### Views NOT in MVP

| View | Reason | When |
|---|---|---|
| Agent Activity & Health | 90% of value covered by Overview + Costs | V2 |
| File Heatmap | Replaced by Top 10 tables in Costs view | V2 |
| Optimization Advisor | Replaced by static Insights panel in Overview | V2 |
| Quality deep-dive | Tier 1 metrics shown inline on Overview | V2 |

---

## 3. View Specifications

### 3.1 Overview (Landing Page)

**Layout:** 5 KPI cards at top, 2 charts in the middle row, insights panel + team leaderboard at bottom.

**KPI Cards (top row):**

| Card | Value | Subtext |
|---|---|---|
| Total Sessions | `12,847` | +12% vs. last period |
| Total Cost | `$4,231` | +8% vs. last period |
| Active Users | `142 / 200` | 71% adoption rate |
| Completion Rate | `87.3%` | sessions completed / total |
| Cost per Session | `$0.33` | North Star metric, weekly trend arrow |

**Go Live Button (filter bar, right side):**
- "Go Live" button with pulsing dot indicator — only visible on the Overview page
- When clicked: the server pushes frequent updates (every 5 seconds) to this view only. KPI cards, charts, insights, and leaderboard refresh automatically.
- Button changes to "Stop Live" (outline style, red dot) — clicking it stops the server push and returns to the static snapshot.
- **Implementation:** Uses Server-Sent Events (SSE) on a dedicated endpoint (`GET /api/overview/live`). The connection is opened when "Go Live" is clicked and closed on "Stop Live", page navigation, or tab close.
- **Only the Overview screen supports live mode.** All other views (Costs, Teams, Settings) are standard request/response — data loads on page open and filter change, no polling, no streaming.

**Charts (middle row):**
- **Left:** Sessions over time (bar chart, daily, 30-day default). Stacked by status: completed (green), error (red), cancelled (gray).
- **Right:** Cost over time (line chart, daily, 30-day default). With dotted budget line if budget is set.

**Insights Panel (bottom left):**
Up to 3 static insight cards:
1. Highest-cost team: "**Backend** spent $1,204 this week — 42% above org average"
2. Lowest cache hit rate: "**Frontend** has 23% cache hit rate vs. 61% org average"
3. Most expensive session: "Session #8a3f cost $12.40 — 37x the average"

Each card links to the relevant Costs or Teams view with filters pre-applied.

**Team Leaderboard (bottom right):**
Sortable table: Team | Sessions | Cost | Completion Rate | Cost/Session. Default sort: by cost descending. Click row to navigate to Teams view filtered to that team.

---

### 3.2 Cost & Usage

**Layout:** Summary cards at top, token breakdown chart, cache panel, budget tracker, file tables at bottom.

**Summary Cards (top row):**

| Card | Value |
|---|---|
| Total Spend | `$4,231` |
| Input Tokens | `28.4M` ($2,840) |
| Output Tokens | `6.2M` ($930) |
| Cache Reads | `14.1M` ($141) — savings badge: "Saved $1,269" |

**Token Breakdown (left, middle row):**
- Stacked bar chart: spend by token type (input, output, cache_creation, cache_read) over time
- Toggle: by team / by model / by user

**Cache Efficiency Panel (right, middle row):**
- Gauge: org-wide cache hit rate (e.g., 61%)
- Bar chart: cache hit rate per team (horizontal bars, sorted ascending — worst teams first)
- Trend line: cache hit rate over time (should go up)
- Savings callout: "Cache saved your org $1,269 this period"

**Budget Tracker (full width):**
- Progress bar: actual spend vs. budget (e.g., $4,231 / $6,000 = 70.5%)
- Projected month-end spend (dashed line extension)
- Alert thresholds shown as markers on the bar (50%, 75%, 90%, 100%)

**Top Files Tables (bottom row):**
Two side-by-side tables:

| Top 10 Most-Read Files | Reads | Sessions | Token Cost |
|---|---|---|---|
| `src/services/payment.ts` | 342 | 89 | $8.21 |
| ... | | | |

| Top 10 Most-Edited Files | Edits | Sessions | Churn (edits/session) |
|---|---|---|---|
| `src/api/routes.ts` | 156 | 67 | 2.3 |
| ... | | | |

---

### 3.3 Teams & Users

**Layout:** Team selector at top, team summary cards, user table, adoption chart.

**Team Selector:**
Dropdown or tab bar listing all teams. "All Teams" is default (shows comparison view).

**Comparison View (All Teams):**
Table with sparklines:

| Team | Sessions | Cost | Completion Rate | Cost/Session | Cache Hit Rate | Trend (30d) |
|---|---|---|---|---|---|---|
| Backend | 4,230 | $1,204 | 89% | $0.28 | 67% | sparkline |
| Frontend | 3,102 | $1,456 | 84% | $0.47 | 23% | sparkline |
| Platform | 2,891 | $892 | 91% | $0.31 | 71% | sparkline |
| ... | | | | | | |

Click a row to drill into that team.

**Single Team View:**
- Team KPI cards (same 5 as Overview, but scoped to this team)
- User table:

| User | Sessions | Cost | Completion Rate | Cost/Session | Last Active |
|---|---|---|---|---|---|
| alice@co.com | 312 | $89 | 92% | $0.29 | 2h ago |
| bob@co.com | 287 | $201 | 78% | $0.70 | 1d ago |
| ... | | | | | |

- Adoption chart: new users over time (line chart), usage frequency histogram (how many sessions per user per week)
- Usage patterns: sessions by hour-of-day heatmap (simple grid), preferred model distribution (donut chart)

---

### 3.4 Settings

**Layout:** Simple form-based view.

**Budget Configuration:**
- Monthly budget amount (USD input)
- Alert thresholds: checkboxes for 50%, 75%, 90%, 100% with notification toggle
- Per-team budget overrides (optional)

**Notification Preferences:**
- Alert delivery: email, in-app, or both
- Anomaly detection: on/off toggle, sensitivity (low/medium/high)

---

## 4. Global Filter Bar

Sticky bar at the top of every view:

```
[Today v] [7d] [30d] [90d] [Custom v]  |  Team: [All v]  |  User: [All v]  |  Model: [All v]  |  [Export CSV v]
```

- Time range changes apply to all cards, charts, and tables on the current view
- Filter state persists in URL (shareable links)
- "Export CSV" exports the current view's data with active filters applied

---

## 5. Data Requirements

### 5.1 API Endpoints

| Endpoint | Purpose | Used by |
|---|---|---|
| `GET /api/sessions/summary` | Aggregated session counts, completion rates by time bucket | Overview, Teams |
| `GET /api/costs/breakdown` | Cost breakdown by team, user, model, token type | Costs, Overview |
| `GET /api/costs/cache` | Cache hit rates and savings by team, over time | Costs |
| `GET /api/costs/budget` | Budget config, actual vs. budget, projections | Costs, Settings |
| `GET /api/teams` | Team list with summary metrics | Teams, Filters |
| `GET /api/teams/{id}/users` | Per-user metrics for a team | Teams |
| `GET /api/files/top` | Top read/edited files with frequency and cost | Costs |
| `GET /api/insights` | Pre-computed top 3 insights | Overview |
| `GET /api/quality/tier1` | Session success rate, error rates, tool errors | Overview |
| `POST /api/alerts` | Create/update budget alert thresholds | Settings |
| `GET /api/overview/live` | SSE stream — pushes KPI, chart, insights, leaderboard updates every 5s | Overview (Go Live) |

All endpoints accept query params: `?from=&to=&team_id=&user_id=&model=`

### 5.2 Mock Data Scale

For the MVP demo/development, generate mock data:
- 1 org, 6 teams, 50 users
- 30 days of session history
- ~3,000 sessions total (100/day)
- 3 model tiers (Haiku, Sonnet, Opus) with realistic price ratios
- Realistic token distributions: avg 500 input, 200 output, 30% cache hit rate
- 10-15% error rate, mixed error categories

---

## 6. Tech Stack (Recommended)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR for fast initial load, file-based routing |
| UI Components | shadcn/ui + Tailwind CSS | Rapid UI development, accessible components |
| Charts | Recharts or Tremor | React-native charting, good for dashboards |
| State | URL search params + React Query | Filter state in URL (shareable), server state management |
| API | Next.js API routes (mock) | Co-located mock API, easy to swap for real backend |
| Data | In-memory mock data + JSON seed files | No database in MVP; mock API returns generated data |

---

## 7. Mockup Index

Each view has an SVG mockup in this directory:

| File | View |
|---|---|
| [`mockup-overview.svg`](./mockup-overview.svg) | Organization Overview (landing page) |
| [`mockup-costs.svg`](./mockup-costs.svg) | Cost & Usage Analytics |
| [`mockup-teams.svg`](./mockup-teams.svg) | Teams & Users |
| [`mockup-settings.svg`](./mockup-settings.svg) | Settings (budget & alerts) |

---

## 8. Delivery Milestones

| Week | Milestone | Deliverable |
|---|---|---|
| 1 | Foundation | Project setup, mock data generation, API routes, layout shell with nav + filter bar |
| 2 | Overview | KPI cards, session chart, cost chart, team leaderboard |
| 3 | Cost & Usage | Token breakdown, cache panel, budget tracker, file tables |
| 4 | Teams & Users | Team comparison, user drill-down, adoption chart |
| 5 | Settings + Polish | Budget config, alerts, insights panel, responsive fixes |
| 6 | Testing + Launch | E2E tests, accessibility pass, performance audit, deploy |

---

## 9. What MVP Proves

If the MVP succeeds:
- Engineering managers **return weekly** to check team costs (30% WAU at 60 days)
- At least **50% of orgs** configure a budget alert (proves cost anxiety is real)
- Users **export cost data** (proves the data flows into real budget workflows)
- The North Star — **cost per completed session** — trends downward for active orgs

If these don't happen, we pivot before investing in V2 features.
