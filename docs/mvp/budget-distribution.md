# Budget Distribution Logic

**Date:** 2026-04-06
**Status:** Implemented (Stage 1)

---

## 1. Overview

The organization has a total monthly budget. Each department (team) gets a share of it. Departments can have a **budget override** (manually set by user) or receive an **auto-calculated** share from the remaining budget.

Budget state is stored in PostgreSQL (`budget_config` table) and broadcast to all clients via SSE on every change.

---

## 2. Budget Distribution Algorithm

### 2.1 Auto-distribution

Given:
- `totalBudget` — organization monthly budget
- `overrides` — `Record<teamId, amount>` — manually set budgets
- `allTeams` — list of all team IDs

Calculation:
1. Sum all overrides: `overrideSum = sum(overrides.values)`
2. Remaining budget: `remaining = totalBudget - overrideSum`
3. Count non-overridden teams: `autoCount = allTeams.length - overrides.size`
4. Auto budget per team: `autoBudget = remaining > 0 ? remaining / autoCount : 0`
5. Each team gets: `override[teamId]` if overridden, else `autoBudget`

### 2.2 Minimum budget

- No minimum. If remaining budget is zero or negative, auto teams get `$0`.
- Previous behavior ($1 minimum) was removed because it created phantom budget that didn't exist.

**Implementation:**
- Frontend: `distributeBudget()` in `packages/frontend/src/shared/utils/budget.ts`
- Backend: `fetchBudgetState()` in `packages/backend/src/routes/budgets.ts`
- Backend: `computeUpdatedBudget()` in `packages/backend/src/budget-logic.ts`

---

## 3. Editing a Team Budget

Two entry points, same server endpoint (`POST /api/budgets/team`):
- From all-teams grid: `/teams?editTeam=:id` → `editGridTeamBudgetRoute`
- From team detail: `/teams/:id?edit=true` → `editTeamBudgetRoute`

### 3.1 Increasing a team budget

When user enters a value **higher** than the team's current allocation:
- Show yellow warning: `"Your budget will be increased by $X. Other non-overridden departments will receive less."`
- On Save: server auto-expands the org budget by the delta, stores override

**Server-side expansion logic** (`computeUpdatedBudget`):
1. Compute current auto-distribution for non-overridden teams
2. For each new/changed override: `delta = newValue - oldAllocation`
3. If `delta > 0`: `monthlyBudget += delta`
4. Save expanded budget + new overrides

### 3.2 Decreasing a team budget

When user enters a value **lower** than current:
- Show info: `"Budget decreased by $X. Freed budget will be redistributed to non-overridden departments."`
- On Save: org budget stays the same. Freed amount auto-distributes.

### 3.3 Removing an override

- If user clears the input or sets ≤ 0: remove the override, team returns to auto-calculated share
- Show info: `"This department will use auto-calculated budget."`

**Implementation:**
- Frontend delta display: `getTeamBudgetDelta()` in `budget.ts`
- Backend save: `POST /api/budgets/team { teamId, budget }` — server merges, expands, saves, broadcasts

---

## 4. Editing the Organization Budget

Entry point: `/teams?edit` → `editBudgetRoute`

### 4.1 Budget lower than current total spend

- **Block save.** Red error: `"Cannot set budget below current spend ($X)"`

### 4.2 Budget lower than sum of overrides

- **Block save.** Red error listing top 3 overridden teams: `"Budget $X is below team overrides total $Y: TeamA ($Z), TeamB ($W), ... and N more. Remove or reduce team overrides first."`
- Previous behavior (allow save + shrink overrides) was replaced with hard error.

### 4.3 Budget is zero or negative

- **Block save.** Red error: `"Budget must be greater than $0"`

**Implementation:**
- Frontend validation: `validateOrgBudget()` in `budget.ts`
- Backend validation: `computeUpdatedBudget()` throws `BudgetValidationError`

---

## 5. Validation Rules Summary

| Condition | Action | UI Feedback |
|---|---|---|
| Org budget ≤ 0 | Block save | Red error |
| Org budget < current spend | Block save | Red error with spend amount |
| Org budget < sum of overrides | Block save | Red error listing teams |
| Team budget increased | Allow save, server expands org budget | Yellow warning showing delta |
| Team budget decreased | Allow save, org budget unchanged | Info showing freed amount |
| Team budget cleared (≤ 0) | Remove override | Info about auto-calculation |
| Remaining budget ≤ 0 | Auto teams get $0 | — |

---

## 6. Architecture

```
Frontend (modal)                    Backend
     │                                │
     │  POST /api/budgets/team        │
     │  { teamId: "backend",          │
     │    budget: 5000 }              │
     │ ──────────────────────────────>│
     │                                │  1. Read current config from PG
     │                                │  2. Merge new override
     │                                │  3. computeUpdatedBudget()
     │                                │     - auto-expand if delta > 0
     │                                │     - validate budget ≥ override sum
     │                                │  4. Save to PG
     │                                │  5. Broadcast via SSE
     │  { success: true }             │
     │ <──────────────────────────────│
     │                                │
     │  SSE /api/budgets/live          │
     │ <──── { monthlyBudget,         │
     │        teamOverrides,           │
     │        autoBudget,              │
     │        teamBudgets[] }          │
```

---

## 7. Edge Cases

1. **All teams overridden:** `autoCount = 0`, no auto-distribution. Org budget = sum of overrides.
2. **Single team:** team gets the full budget (override or auto).
3. **Override equals current auto budget:** no visible change, but override is stored.
4. **Override consumes entire budget:** remaining = 0, auto teams get $0.
5. **Budget expansion:** when team override increases, org budget grows to accommodate. Other teams' auto-budgets stay the same.
6. **Floating point tolerance:** budget change detection uses `Math.abs(delta) > 0.01` to avoid false positives from rounding.
7. **Concurrent edits:** PostgreSQL is source of truth. SSE broadcast ensures all clients see the latest state.
