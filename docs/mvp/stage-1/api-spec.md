# API Specification

The Rust service does NOT serve an API. Instead, it writes pre-aggregated data to PostgreSQL. The TypeScript backend reads from PostgreSQL directly with simple queries.

This document specifies what the TypeScript backend needs to query for each endpoint.

## Common Query Parameters

All filterable endpoints accept these from the frontend:

| Param | Type | Default | Values | SQL Mapping |
|-------|------|---------|--------|-------------|
| `range` | string | `"30d"` | `today`, `7d`, `30d`, `90d` | `WHERE date >= NOW() - INTERVAL '30 days'` |
| `team_id` | string | none | any team ID | `AND team_id = $team_id` |
| `user_id` | string | none | any user ID | `AND user_id = $user_id` |
| `model` | string | none | `haiku`, `sonnet`, `opus` | `AND model = $model` |

Range to interval: `today` = 1 day, `7d` = 7 days, `30d` = 30 days, `90d` = 90 days.

---

## Endpoints → PostgreSQL Queries

### 1. GET /api/sessions/summary → SessionSummary

**Table:** `daily_session_summary`

**Query pattern:**
```sql
-- Totals
SELECT SUM(total_sessions), SUM(completed), SUM(errored), SUM(cancelled),
       SUM(total_cost), SUM(active_users)
FROM daily_session_summary
WHERE date >= $cutoff
  AND ($team_id IS NULL OR team_id = $team_id)
  AND ($model IS NULL OR model = $model);

-- Daily trend  
SELECT date, SUM(total_sessions) as sessions, SUM(completed), SUM(errored), SUM(cancelled)
FROM daily_session_summary
WHERE date >= $cutoff ...
GROUP BY date ORDER BY date;

-- Cost trend
SELECT date, SUM(total_cost) as cost
FROM daily_session_summary  
WHERE date >= $cutoff ...
GROUP BY date ORDER BY date;
```

**Computed in TypeScript:**
- `completionRate = completedSessions / totalSessions`
- `adoptionRate = activeUsers / totalUsers` (totalUsers from `SELECT COUNT(*) FROM users`)
- `costPerSession = totalCost / totalSessions`

### 2. GET /api/costs/breakdown → CostBreakdown

**Tables:** `daily_token_stats`, `daily_session_summary`

**Query pattern:**
```sql
-- By team
SELECT team_id, t.name as team_name, SUM(total_cost) as cost
FROM daily_token_stats dts JOIN teams t ON t.id = dts.team_id
WHERE date >= $cutoff ...
GROUP BY team_id, t.name ORDER BY cost DESC;

-- By model
SELECT model, SUM(total_cost) as cost
FROM daily_token_stats WHERE date >= $cutoff ...
GROUP BY model;

-- By token type (aggregate all)
SELECT SUM(input_tokens), SUM(output_tokens), SUM(cache_creation), SUM(cache_read)
FROM daily_token_stats WHERE date >= $cutoff ...;

-- Daily token trend
SELECT date, SUM(input_tokens), SUM(output_tokens), SUM(cache_creation), SUM(cache_read)
FROM daily_token_stats WHERE date >= $cutoff ...
GROUP BY date ORDER BY date;
```

**Computed in TypeScript:**
- `costPerSession = total / totalSessions`
- Token-type costs computed from token sums using pricing constants

### 3. GET /api/costs/cache → CacheData

**Table:** `daily_token_stats`

**Query pattern:**
```sql
-- Org-wide
SELECT SUM(cache_read) as total_cache_read, SUM(input_tokens) as total_input
FROM daily_token_stats WHERE date >= $cutoff ...;

-- By team
SELECT team_id, t.name, SUM(cache_read), SUM(input_tokens)
FROM daily_token_stats dts JOIN teams t ON t.id = dts.team_id
WHERE date >= $cutoff ...
GROUP BY team_id, t.name;

-- Daily trend
SELECT date, SUM(cache_read), SUM(input_tokens)
FROM daily_token_stats WHERE date >= $cutoff ...
GROUP BY date ORDER BY date;
```

**Computed in TypeScript:**
- `cacheHitRate = cache_read / (cache_read + input_tokens)`
- `savings = cache_read * (model.input_price - model.cache_read_price) / 1_000_000`

### 4. GET /api/costs/budget → BudgetData

**Tables:** `daily_session_summary`, `budget_config`

**Query pattern:**
```sql
-- Current month spend
SELECT SUM(total_cost) FROM daily_session_summary
WHERE date >= date_trunc('month', NOW());

-- Budget config
SELECT monthly_budget, thresholds, team_overrides FROM budget_config WHERE id = 1;

-- Per-team spend this month
SELECT team_id, t.name, SUM(total_cost)
FROM daily_session_summary dss JOIN teams t ON t.id = dss.team_id
WHERE date >= date_trunc('month', NOW())
GROUP BY team_id, t.name;
```

**Computed in TypeScript:**
- `projected = currentSpend / dayOfMonth * daysInMonth`
- `percentUsed = currentSpend / monthlyBudget`
- Team budget distribution: overridden teams get their override, others get `(budget - sum(overrides)) / remaining_count`

### 5. GET /api/teams → Team[]

**Tables:** `daily_session_summary`, `teams`

**Query pattern:**
```sql
SELECT team_id, t.name,
       SUM(total_sessions) as sessions,
       SUM(total_cost) as cost,
       SUM(completed)::float / NULLIF(SUM(total_sessions), 0) as completion_rate,
       SUM(total_cost) / NULLIF(SUM(total_sessions), 0) as cost_per_session
FROM daily_session_summary dss
JOIN teams t ON t.id = dss.team_id
WHERE date >= $cutoff
  AND ($model IS NULL OR model = $model)
GROUP BY team_id, t.name;
```

**For 7-day trend (per team):**
```sql
SELECT team_id, date, SUM(total_sessions) as sessions
FROM daily_session_summary
WHERE date >= NOW() - INTERVAL '7 days'
GROUP BY team_id, date
ORDER BY team_id, date;
```

**Cache hit rate (per team):**
```sql
SELECT team_id, SUM(cache_read)::float / NULLIF(SUM(cache_read + input_tokens), 0) as cache_hit_rate
FROM daily_token_stats
WHERE date >= $cutoff ...
GROUP BY team_id;
```

### 6. GET /api/teams/:id/users → TeamUser[]

**Tables:** `team_user_stats`, `users`

```sql
SELECT u.id, u.email,
       SUM(tus.sessions) as sessions,
       SUM(tus.cost) as cost,
       SUM(tus.completed)::float / NULLIF(SUM(tus.sessions), 0) as completion_rate,
       SUM(tus.cost) / NULLIF(SUM(tus.sessions), 0) as cost_per_session,
       MAX(tus.last_active) as last_active
FROM team_user_stats tus
JOIN users u ON u.id = tus.user_id
WHERE tus.team_id = $team_id
  AND tus.date >= $cutoff
GROUP BY u.id, u.email;
```

### 7. GET /api/files/top → TopFilesData

**No PostgreSQL table needed.** This endpoint uses hardcoded file paths and derives counts from session totals using a deterministic formula. Port the same logic from TypeScript.

**Source:** `packages/backend/src/routes/files.ts:7-23` (FILE_PATHS array) and lines 26-62 (weight formula).

### 8. GET /api/insights → Insight[]

**Tables:** `daily_session_summary`, `daily_token_stats`

Computed on the fly from 3 queries:

1. **High Cost Team:** Team with highest `SUM(total_cost)` vs average
2. **Low Cache Rate:** Team with lowest `cache_read / (cache_read + input_tokens)` vs org average
3. **Expensive Session:** Not directly available from aggregates. Options:
   - Query TimescaleDB directly for `MAX(cost)` session (acceptable for this endpoint)
   - Or store a `max_session_cost` column in `daily_session_summary`

### 9. GET /api/quality/tier1 → QualityTier1

**Table:** `daily_quality_stats`

```sql
SELECT SUM(completed)::float / NULLIF(SUM(total_sessions), 0) as success_rate,
       SUM(tool_errors)::float / NULLIF(SUM(tool_calls), 0) as tool_error_rate,
       SUM(errors_api), SUM(errors_tool), SUM(errors_permission), SUM(errors_runtime)
FROM daily_quality_stats
WHERE date >= $cutoff
  AND ($team_id IS NULL OR team_id = $team_id)
  AND ($model IS NULL OR model = $model);
```

`retryableRecoveryRate` = hardcoded `0.60`.

### 10. GET /api/alerts → AlertEvent[]

**Table:** `alerts_log`

```sql
SELECT id, type, severity, title, description, team_id, ts as timestamp
FROM alerts_log
ORDER BY ts DESC
LIMIT 25;
```

### 11. GET /api/overview/live → SSE LiveUpdate

**Tables:** `daily_session_summary`, `daily_token_stats`

Same queries as `/sessions/summary` but:
- Sent as Server-Sent Events every 67ms (~15/sec)
- Each tick applies jitter: `value * (0.9 + Math.random() * 0.2)`
- Includes team metrics and insights in each update

### 12. GET /api/budgets → budget config

```sql
SELECT monthly_budget, team_overrides FROM budget_config WHERE id = 1;
```

### 13. POST /api/budgets → update budget

```sql
UPDATE budget_config
SET monthly_budget = $budget, team_overrides = $overrides
WHERE id = 1;
```

Only endpoint that writes to PostgreSQL from TypeScript.
