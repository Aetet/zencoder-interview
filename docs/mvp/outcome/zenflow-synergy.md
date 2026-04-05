# ZenDash + ZenFlow Synergy Analysis

**Date:** 2026-04-04

---

## What ZenFlow Does

ZenFlow is a production AI coding agent. It generates code, runs tools, handles multi-step tasks. It produces sessions, costs, token usage — the exact data ZenDash monitors.

## Synergy Points

### 1. Direct Data Pipeline

ZenFlow generates the events ZenDash consumes:
- **Sessions** — each ZenFlow task = one session with start/end, tokens, cost, status
- **Tool calls** — ZenFlow's tool use (file reads, edits, bash commands) maps to ZenDash's tool metrics
- **Error categories** — ZenFlow errors (API, tool, permission, runtime) feed into quality tier metrics
- **Model selection** — ZenFlow picks Haiku/Sonnet/Opus per task, ZenDash shows model distribution

**Integration path:** ZenFlow emits events to a queue (Redis/Kafka). ZenDash backend consumes and aggregates. Replace mock data generator with real event consumer.

### 2. Team Attribution

ZenFlow runs in developer environments. Each developer belongs to a team. ZenDash attributes costs to teams automatically — no manual tagging.

**Integration path:** ZenFlow reports `userId` + `teamId` with each session. ZenDash's existing `GET /api/teams` and per-team drill-down work unchanged.

### 3. Budget Controls Feed Back to ZenFlow

ZenDash budget alerts can throttle ZenFlow usage:
- Team exceeds budget → ZenDash fires `budget_exceeded` alert
- Alert triggers ZenFlow rate limiting for that team
- Dashboard shows the throttling in real-time via SSE

**Integration path:** ZenDash `POST /api/budgets` updates shared config. ZenFlow reads budget limits before starting expensive tasks.

### 4. Cache Optimization Loop

ZenDash shows cache hit rates per team. Low cache hit = wasted money. ZenFlow can use this feedback:
- ZenDash identifies teams with <30% cache hit rate
- Insight: "Frontend team has 23% cache hit rate — consider enabling prompt caching"
- ZenFlow auto-enables caching strategies for flagged teams

### 5. Quality Metrics Inform Agent Tuning

ZenDash tracks session success rate, error categories, tool error rate. This data helps tune ZenFlow:
- High tool error rate → ZenFlow needs better tool selection logic
- Low completion rate for Haiku → switch default model to Sonnet for complex tasks
- Permission errors → ZenFlow needs updated access configs

---

## What's Missing for Full Integration

| Gap | Effort | Priority |
|---|---|---|
| Real event ingestion (replace mock) | 2 weeks | P0 |
| Authentication (org/team scoping) | 1 week | P0 |
| Database (PostgreSQL for persistence) | 1 week | P0 |
| ZenFlow event schema alignment | 3 days | P0 |
| Webhook for budget alerts → ZenFlow | 3 days | P1 |
| Real-time SSE from production data | 1 week | P1 |
| Per-session drill-down (link to ZenFlow task) | 1 week | P2 |

---

## Competitive Advantage

ZenDash + ZenFlow together create a **closed loop**: agent generates costs → dashboard monitors → budget controls throttle → agent adapts. Competitors (Copilot, Cursor) don't offer this feedback loop. They show usage stats but don't control spend.

The budget distribution algorithm (auto-distribution + overrides + proportional shrinking) is a differentiator. Engineering leaders can set org budget, override per-team, and the system auto-distributes the rest — no spreadsheet needed.
