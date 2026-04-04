# Reatom Patterns: Lessons from ZenDash

**Date:** 2026-04-04
**Context:** Patterns discovered while building a live-updating dashboard with 1000-row tables, SSE at 15 updates/second, and reatom v1000 + React 19.

---

## 1. Reactive Data Fetching: `computed` + `withAsyncData`

**Pattern:** Define a `computed(async () => ...)` that reads filter atoms. Extend with `withAsyncData`. The computed auto-refetches when any dependency changes, only while subscribed.

```ts
import { computed, withAsyncData, wrap } from '@reatom/core'

export const overviewResource = computed(async () => {
  const params = filterParams() // reading this atom creates a dependency
  const [summary, teams] = await Promise.all([
    wrap(api.sessions.summary(params)),
    wrap(api.teams.list(params)),
  ])
  return { summary, teams }
}, 'overview.resource').extend(withAsyncData({ initState: null }))

// Usage:
// overviewResource.data()   — resolved data or null
// overviewResource.ready()  — true when loaded
// overviewResource.error()  — error if failed
// overviewResource.retry()  — force re-fetch
```

**Key rule:** You must read `overviewResource()` (the async computed itself) somewhere — not just `.data()` — to trigger the fetch. `.data` and `.ready` are sub-atoms; they don't activate the parent computed.

**Lesson learned:** If your data never loads, check that something subscribes to the computed itself, not just its `.data` atom.

---

## 2. Granular Computed Atoms to Prevent Unnecessary Re-Renders

**Pattern:** Derive individual values from a resource via separate `computed` atoms. Each component subscribes only to what it reads.

```ts
const summaryData = computed(
  () => overviewResource.data()?.summary ?? null,
  'overview.summaryData',
)

// Each of these is a separate subscription — changing totalCost
// doesn't re-render a component that only reads totalSessions
export const totalSessions = computed(
  () => summaryData()?.totalSessions ?? 0,
  'overview.totalSessions',
)

export const totalCost = computed(
  () => summaryData()?.totalCost ?? 0,
  'overview.totalCost',
)
```

**Why:** If a component reads `overviewResource.data()?.summary?.totalSessions` directly, it subscribes to the entire `.data` atom — any field change causes a re-render. Granular computeds isolate subscriptions.

---

## 3. Live Override Atoms (SSE Pattern)

**Problem:** SSE pushes data at high frequency. Writing into the main resource atom triggers cascading recomputations and can cause infinite loops.

**Pattern:** Create separate "live override" atoms. Public computed atoms pick from overrides if present, else fall back to resource data.

```ts
// Override atoms — only set during live mode
const liveKpis = atom<KpiData | null>(null, 'overview.liveKpis')

// Public computed — picks live data if available
export const totalSessions = computed(() => {
  const lk = liveKpis()
  return lk ? lk.totalSessions : summaryData()?.totalSessions ?? 0
}, 'overview.totalSessions')

// SSE handler writes to overrides, never to overviewResource
function applyLiveUpdate(data: LivePayload) {
  liveKpis.set({ ... })
}

// On stop: clear overrides, computed falls back to resource
function stopLive() {
  liveKpis.set(null)
}
```

**Why this prevents infinite loops:** `overviewResource` is a `computed(async ...)` that reads `filterParams()`. If you write to `overviewResource.data`, it can retrigger the computed chain. Live override atoms are isolated — they don't participate in the resource's dependency graph.

---

## 4. Two-Array Approach for High-Frequency List Updates

**Problem:** SSE sends 1000 team objects every 67ms. Updating any reatom state with this data triggers React re-renders.

**Pattern:** Two arrays:
1. **`freshestTeams`** — plain JS variable, overwritten on every SSE event. Zero cost.
2. **`renderTeams`** — reatom atom, updated on a throttled timer. Triggers React only when flushed.

```ts
let freshestTeams: Team[] = []
export const renderTeams = atom<Team[]>([], 'overview.renderTeams')

function applyLiveUpdate(data: LivePayload) {
  // KPIs — every frame (cheap)
  liveKpis.set({ ... })

  // Teams — just store, zero cost
  if (data.teams) freshestTeams = data.teams
}

// Flush to render atom on timer
setInterval(() => {
  if (freshestTeams.length > 0) {
    renderTeams.set(freshestTeams)
  }
}, 500)
```

**Why:** Decouples SSE ingestion rate from render rate. SSE runs at 15/s, renders at 2/s. The plain JS variable absorbs the high-frequency writes with zero overhead.

---

## 5. Atom-Bound DOM Cells (reatom/jsx Pattern)

**Problem:** React cannot efficiently update 1000 table rows. Even with `memo`, keyed lists, and `content-visibility`, React's reconciliation costs ~10ms per 1000-row update — causing visible FPS drops.

**Pattern:** Build table rows as real DOM elements. Bind each cell to an atom via `.subscribe()`. Updates bypass React entirely.

```ts
interface TeamRowModel {
  id: string
  sessions: Atom<string>  // formatted display value
  cost: Atom<string>
  rate: Atom<string>
}

function createReactiveCell(a: Atom<string>, className: string): HTMLTableCellElement {
  const td = document.createElement('td')
  td.className = className
  td.textContent = a()
  a.subscribe((v) => { td.textContent = v })
  return td
}
```

**Live update flow:**
```
SSE event
  → model.sessions.set("142")
  → atom subscription fires
  → td.textContent = "142"
  (no React render, no VDOM diff)
```

**React wrapper:** A plain React component renders an empty `<div ref={containerRef} />`. The imperative table is appended to this div. React never sees the 1000 rows.

```tsx
export function TeamLeaderboard() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { element, unsubs } = buildReactiveTable(teams)
    containerRef.current.appendChild(element)
    return () => unsubs.forEach(u => u())
  }, [teams])

  return <div ref={containerRef} />
}
```

**Performance result:** 1000 rows updating at 2-3/s with zero FPS impact. KPIs updating at 60fps simultaneously.

---

## 6. `reatomComponent` vs `reatomFactoryComponent` vs Plain React

### `reatomComponent`

Use for components that **read global atoms** and re-render when they change.

```tsx
export const KpiCards = reatomComponent(() => {
  const sessions = totalSessions() // subscribes, re-renders on change
  return <div>{sessions}</div>
}, 'KpiCards')
```

**Pitfall:** Every atom read inside the render function creates a subscription. Reading 1000 atoms = 1000 subscriptions = 1000 potential re-renders.

### `reatomFactoryComponent`

Use for components that need **local state/effects with automatic cleanup**.

```tsx
export const OverviewPage = reatomFactoryComponent(() => {
  // Factory: runs once on mount
  effect(() => {
    return () => { /* cleanup on unmount */ }
  }, 'cleanup')

  // Render: runs on atom changes
  return () => {
    const data = overviewResource.data()
    return <div>{data}</div>
  }
}, 'OverviewPage')
```

**Pitfall:** The render function still re-runs on every atom change. If it outputs JSX with 1000 elements, React will reconcile them all.

### Plain React Component

Use when you need to **escape reatom's reactive re-rendering** — e.g., for imperative DOM that should not be touched by React.

```tsx
export function TeamLeaderboard() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Manual atom subscription
    const unsub = renderTeams.subscribe((teams) => {
      buildImperativeTable(containerRef.current, teams)
    })
    return unsub
  }, [])

  return <div ref={containerRef} />
}
```

**When to use:** Large lists (100+ items) with high-frequency updates. React is the wrong tool for this — use direct DOM + atom subscriptions.

---

## 7. `effect` vs `withChangeHook` vs `computed`

| Mechanism | When it runs | Use for |
|---|---|---|
| `effect(() => { ... })` | Subscribes to atoms read inside. Re-runs on changes. | Side effects that react to state changes. |
| `withChangeHook(cb)` | Runs when the atom's value changes. | One-to-one reactions. Must capture return value of `.extend()`. |
| `computed(() => ...)` | Lazy. Runs when subscribed and deps change. | Derived state. |

**`withChangeHook` gotcha:** `.extend(withChangeHook(cb))` returns a new atom. If you discard the return value, the hook is never connected:

```ts
// WRONG — hook never fires
myAtom.extend(withChangeHook((v) => console.log(v)))

// RIGHT — capture the extended atom
const myAtomWithHook = myAtom.extend(withChangeHook((v) => console.log(v)))
```

**`effect` gotcha:** Module-level effects subscribe immediately. If the effect reads an async computed's `.data`, it subscribes to the `.data` atom but NOT the parent computed — the fetch may never trigger.

```ts
// May not work — effect subscribes to .data but not the computed itself
effect(() => {
  const teams = overviewResource.data()?.teams
  // overviewResource never fetches because nothing subscribes to it
})

// Fix — also read the computed to trigger the fetch
effect(() => {
  overviewResource() // subscribe to the async computed
  const teams = overviewResource.data()?.teams
})
```

---

## 8. Performance Tiers for List Rendering

Based on benchmarking 1000 rows with live data at various update frequencies:

| Approach | Update Cost | FPS Impact | Use When |
|---|---|---|---|
| React `teams.map(<Row />)` | ~15ms per render | Drops to 40fps | < 100 items, ≤ 1 update/s |
| React `memo(Row)` + keyed | ~12ms | Drops to 50fps | < 200 items, ≤ 1 update/s |
| Single atom + React render | ~10ms | Drops to 50fps | < 500 items, ≤ 2 updates/s |
| Atom per cell + `.subscribe()` | ~2ms | No drop | Any count, any frequency |
| `content-visibility: auto` | Reduces paint | Helps scrolling | Always add for large lists |

**Recommendation:** For > 100 items with live updates, skip React for the list body. Use atom-bound DOM cells or reatom JSX.

---

## 9. SSE Architecture

```
Backend (15 events/s)
  │
  ▼
EventSource.onmessage
  │
  ├─ pendingLiveData = JSON.parse(event.data)  ← store latest
  │
  └─ if (rafId === null) rafId = requestAnimationFrame(applyLiveUpdate)
                                                  │
                                                  ▼
                                          applyLiveUpdate()
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              liveKpis.set   liveTrend.set   freshestTeams = data
                              (every frame)  (every frame)   (plain JS, free)
                                    │             │
                                    ▼             ▼             
                              KpiCards      SessionsChart     setInterval(500ms)
                              re-renders    re-renders              │
                                                                    ▼
                                                          livePatchFn(freshestTeams)
                                                                    │
                                                                    ▼
                                                          atom.set per cell
                                                                    │
                                                                    ▼
                                                          td.textContent = value
                                                          (no React)
```

**Key insight:** Different update frequencies for different UI elements:
- KPIs: every rAF frame (~60fps) — 5 atom sets, 5 component re-renders
- Charts: every rAF frame — 2 atom sets, 2 Recharts re-renders
- Teams: every 500ms — 5000 atom sets, 5000 textContent assignments, zero React

---

## 10. Anti-Patterns Discovered

### Don't write to `withAsyncData`'s `.data` atom during live mode

```ts
// WRONG — triggers cascading recomputations, potential infinite loops
overviewResource.data.set({ ...current, totalSessions: newValue })
```

Use separate override atoms instead (Pattern 3).

### Don't read 1000 atoms inside a `computed`

```ts
// WRONG — subscribes to all 1000 cost atoms, re-sorts on every change
const sorted = computed(() => {
  return models.sort((a, b) => b.cost() - a.cost())
})
```

Sort once imperatively, store result in a plain atom.

### Don't use `reatomComponent` for large imperative DOM

```tsx
// WRONG — reatom re-runs render on any atom change, React re-diffs 1000 rows
const Table = reatomComponent(() => {
  const teams = renderTeams()
  return <tbody>{teams.map(t => <tr>...</tr>)}</tbody>
}, 'Table')
```

Use a plain React component with `useRef` + imperative DOM.

### Don't pass callback props to `memo` components

```tsx
// WRONG — new function every render breaks memo
<TableBody onRef={(el) => { tbodyEl = el }} teams={frozenTeams} />
```

Use `document.querySelector` or stable refs instead.
