# Budget Distribution Logic

**Date:** 2026-04-04
**Status:** Requirements for MVP

---

## 1. Overview

The organization has a total monthly budget. Each department (team) gets a share of it. Departments can have a **budget override** (manually set by user) or receive an **auto-calculated** share from the remaining budget.

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
4. Auto budget per team: `autoBudget = remaining / autoCount`
5. Each team gets: `override[teamId]` if overridden, else `autoBudget`

### 2.2 Minimum budget

- Minimum per department: **$1**
- If `autoBudget < 1`, set it to `$1`

---

## 3. Editing a Team Budget (Modal)

### 3.1 Increasing a team budget

When user enters a value **higher** than the team's current budget:
- Show yellow warning below input: `"Your budget will be increased by $X. Other non-overridden departments will receive less."`
- On Save: store the override, recalculate auto budgets for remaining teams

### 3.2 Decreasing a team budget

When user enters a value **lower** than the team's current budget:
- Show info below input: `"Budget decreased by $X. Freed budget will be redistributed to non-overridden departments."`
- On Save: store the override, recalculate auto budgets (they increase)

### 3.3 Removing an override

- If user clears the input or sets it to empty: remove the override for this team, team returns to auto-calculated share
- Show info: `"This department will use auto-calculated budget."`

---

## 4. Editing the Organization Budget

### 4.1 Budget lower than current total spend

- **Before save:** Show error toast: `"Cannot set budget below current spend ($X)"`
- **Do not save.** Input stays, user can correct.

### 4.2 Budget lower than sum of overrides

- **Before save:** Show yellow warning below input listing affected departments
- Format: `"Budgets for your departments will be shrunk: TeamA ($X→$Y), TeamB ($X→$Y), ... and N more."`
  - List 6 most expensive overridden departments
  - If more than 6, show `"and N more"`
- **On save:** Shrink each override **evenly** (proportionally) to fit within the new total budget
  - Each override is reduced by the same ratio: `newOverride = override * (newBudget / overrideSum)`
  - If any shrunk override falls below $1, set it to $1
  - Save shrunk overrides to localStorage

### 4.3 Budget is zero or negative

- **Do not save.** Show error toast: `"Budget must be greater than $0"`

---

## 5. Validation Rules Summary

| Condition | Action | UI Feedback |
|---|---|---|
| Org budget ≤ 0 | Block save | Error toast |
| Org budget < current spend | Block save | Error toast with spend amount |
| Org budget < sum of overrides | Allow save, shrink overrides | Yellow warning listing teams |
| Team budget < $1 | Clamp to $1 | — |
| Team budget increased | Allow save | Yellow warning showing delta |
| Team budget decreased | Allow save | Info showing freed amount |
| Team budget cleared | Remove override | Info about auto-calculation |

---

## 6. Edge Cases

1. **All teams overridden:** `autoCount = 0`, `remaining` might be negative or zero — no auto-distribution needed, all budgets are overrides
2. **Single team:** the team gets the full budget (override or auto)
3. **Override equals current auto budget:** no visible change, but override is stored (team won't change when others are edited)
4. **Budget shrink makes all overrides hit $1:** total of overrides becomes `teamCount * $1`, remaining goes to zero
5. **Budget increase after shrink:** overrides stay shrunk (user must manually re-edit each), auto teams benefit
6. **Concurrent edits:** localStorage is the source of truth, last write wins
