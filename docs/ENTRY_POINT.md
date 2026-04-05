# Documentation Guide

This page helps you find the right document fast.

## What is this project?

ZenDash is a dashboard that shows how much AI agent usage costs an organization -- broken down by team, user, model, and time. It ingests streaming events from AI agents, aggregates them, and presents the results in a live-updating UI.

The original assignment: [task.md](task.md)

## How the docs are organized

```
docs/
├── ENTRY_POINT.md                 ← you are here
├── TECH_SETUP.md                  Technical setup: connection strings, commands, troubleshooting
├── task.md                        Original assignment and acceptance criteria
│
├── product-decisions/             Why we're building what we're building
│   ├── product-requirements.md      Business requirements
│   └── competitor-analysis.md       Market landscape
│
├── mvp/                           Dashboard (TypeScript + React)
│   ├── mvp-scope.md                 What we're building, target scale, 4 views
│   ├── architecture.md              Monorepo structure, packages, how backend/frontend connect
│   ├── design-system.md             Colors, typography, component specs, Tailwind config
│   ├── reatom-state-organization.md Where state lives — routes, filters, loaders, file conventions
│   ├── reatom-patterns.md           How to solve tricky problems — SSE, 1000-row tables, caching
│   ├── budget-distribution.md       Budget auto-distribution algorithm, edge cases
│   ├── testing-strategy.md          3-layer testing: unit, component, e2e
│   └── test-cases.md               168 test cases across all layers
│
├── mvp/stage-1/                   Data pipeline (Rust + TimescaleDB + Kafka + PostgreSQL)
│   ├── stage-1-scope.md             Architecture overview, decisions, component roles
│   ├── data-model.md                Every table, every field, why it exists, how events aggregate
│   ├── api-spec.md                  Each API endpoint → which PostgreSQL query serves it
│   └── implementation-plan.md       Build phases, Rust project structure, Docker setup
│
└── reference-agent/               The AI agent we're simulating (Claw Code)
    ├── session.md                   Session lifecycle, ConversationMessage, JSON format
    ├── conversation.md              Turn loop, streaming events, how tools execute
    ├── tools.md                     19 built-in tools, permission levels, input/output schemas
    ├── errors-in-example-agent.md   Error taxonomy, 25 error codes, severity, retryability
    └── low-level-agent-details.md   Token usage tracking, server architecture
```

## Where to look for what

| I want to... | Read this |
|---|---|
| Understand the assignment | [task.md](task.md) |
| Set up the project and run it | [README.md](../README.md) |
| Fix a connection issue, reset data, use simulator commands | [TECH_SETUP.md](TECH_SETUP.md) |
| Understand the data pipeline (Rust → TimescaleDB → Kafka → PG) | [stage-1/stage-1-scope.md](mvp/stage-1/stage-1-scope.md) |
| Know what each database table means, field by field | [stage-1/data-model.md](mvp/stage-1/data-model.md) |
| See which SQL query powers a specific API endpoint | [stage-1/api-spec.md](mvp/stage-1/api-spec.md) |
| Understand how the frontend state works | [reatom-state-organization.md](mvp/reatom-state-organization.md) |
| Handle SSE, large tables, or performance issues in React | [reatom-patterns.md](mvp/reatom-patterns.md) |
| Know what events the AI agent produces | [reference-agent/session.md](reference-agent/session.md) + [conversation.md](reference-agent/conversation.md) |
| Know what error codes exist and what they mean | [reference-agent/errors-in-example-agent.md](reference-agent/errors-in-example-agent.md) |
| Know the full feature scope and what's P0 vs P1 | [mvp-scope.md](mvp/mvp-scope.md) |
| Look up UI colors, fonts, or component specs | [design-system.md](mvp/design-system.md) |
| Understand how budgets distribute across teams | [budget-distribution.md](mvp/budget-distribution.md) |
| Understand product decisions and market context | [product-requirements.md](product-decisions/product-requirements.md) |

## Key concepts in 30 seconds

**Agent session** — a developer uses the AI coding agent. The agent calls the LLM, executes tools (bash, read_file, etc.), loops until done. Each session produces streaming events.

**Streaming events** — individual events like `TextDelta`, `ToolUse`, `Usage`, `MessageStop`. Stored as rows in TimescaleDB. This is the raw data.

**Baked tables** — pre-aggregated PostgreSQL tables (`daily_session_summary`, `daily_token_stats`, etc.). One table per API endpoint. The Rust transformer computes these from raw events.

**Token types** — 4 categories that determine cost: `input` (sent to model), `output` (model generated), `cache_creation` (first-time prompt cache), `cache_read` (cached input, 10x cheaper).

**Models** — haiku (cheap), sonnet (mid), opus (expensive). Pricing differs by 60x between haiku and opus.
