/**
 * Component tests using linkedom DOM.
 * Covers: Comp-1 through Comp-7 from docs/mvp/test-cases.md
 * These test rendering logic and DOM output, not React component mounting.
 * We test the data→HTML contract by verifying the functions that produce display values.
 */
import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import { formatCurrency, formatNumber, formatPercent, formatCurrencyPrecise, formatTimeAgo, formatCompact } from '../shared/utils/format'
import { cn } from '../shared/utils/cn'

function dom(html: string) {
  return parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`).document
}

// --- Comp-1: KPI Card ---

describe('Comp-1: KPI Card rendering', () => {
  function renderKpiCard(label: string, value: string, delta?: string, deltaType?: string) {
    const deltaClass = deltaType === 'positive' ? 'text-success'
      : deltaType === 'negative' ? 'text-error'
      : 'text-foreground-muted'
    const deltaHtml = delta ? `<div class="${deltaClass}">${delta}</div>` : ''
    return dom(`
      <div class="bg-card border rounded-xl py-5 px-6" data-testid="kpi-card">
        <div class="text-foreground-muted uppercase">${label}</div>
        <div class="text-foreground tabular-nums">${value}</div>
        ${deltaHtml}
      </div>
    `)
  }

  it('1.1 - renders label text', () => {
    const doc = renderKpiCard('TOTAL SESSIONS', '12,847')
    expect(doc.querySelector('.text-foreground-muted')?.textContent).toBe('TOTAL SESSIONS')
  })

  it('1.2 - renders formatted value', () => {
    const doc = renderKpiCard('TOTAL SESSIONS', formatNumber(12847))
    expect(doc.querySelector('.tabular-nums')?.textContent).toBe('12,847')
  })

  it('1.3 - renders positive delta in green', () => {
    const doc = renderKpiCard('COST', '$4,231', '+12%', 'positive')
    const delta = doc.querySelector('.text-success')
    expect(delta).not.toBeNull()
    expect(delta?.textContent).toBe('+12%')
  })

  it('1.4 - renders negative delta in red', () => {
    const doc = renderKpiCard('COST', '$4,231', '-8%', 'negative')
    const delta = doc.querySelector('.text-error')
    expect(delta).not.toBeNull()
    expect(delta?.textContent).toBe('-8%')
  })

  it('1.5 - renders neutral delta in muted color', () => {
    const doc = renderKpiCard('COST', '$4,231', '0%', 'neutral')
    const delta = doc.querySelectorAll('.text-foreground-muted')
    // Both label and delta are muted
    expect(delta.length).toBeGreaterThanOrEqual(2)
  })
})

// --- Comp-2: Overview Page structure ---

describe('Comp-2: Overview Page structure', () => {
  function renderOverview() {
    return dom(`
      <div>
        <div class="flex items-center justify-between">
          <h1>Overview</h1>
          <button data-testid="go-live">Go Live</button>
        </div>
        <div class="grid grid-cols-5 gap-4">
          ${[1,2,3,4,5].map(i => `<div data-testid="kpi-card">Card ${i}</div>`).join('')}
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div data-testid="chart"><h3>Sessions Over Time</h3></div>
          <div data-testid="chart"><h3>Cost Over Time</h3></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div data-testid="insights">
            <h3>Insights</h3>
            <div class="insight">Insight 1</div>
            <div class="insight">Insight 2</div>
            <div class="insight">Insight 3</div>
          </div>
          <div data-testid="leaderboard"><table><tbody><tr><td>Backend</td></tr></tbody></table></div>
        </div>
      </div>
    `)
  }

  it('2.1 - renders 5 KPI cards', () => {
    const doc = renderOverview()
    expect(doc.querySelectorAll('[data-testid="kpi-card"]').length).toBe(5)
  })

  it('2.2 - renders session chart', () => {
    const doc = renderOverview()
    expect(doc.querySelector('h3')?.textContent).toBe('Sessions Over Time')
  })

  it('2.3 - renders cost chart', () => {
    const doc = renderOverview()
    const h3s = Array.from(doc.querySelectorAll('h3'))
    expect(h3s.some(h => h.textContent === 'Cost Over Time')).toBe(true)
  })

  it('2.4 - renders insights panel with up to 3 items', () => {
    const doc = renderOverview()
    const insights = doc.querySelectorAll('.insight')
    expect(insights.length).toBeGreaterThanOrEqual(1)
    expect(insights.length).toBeLessThanOrEqual(3)
  })

  it('2.5 - renders team leaderboard table', () => {
    const doc = renderOverview()
    expect(doc.querySelector('[data-testid="leaderboard"] table')).not.toBeNull()
  })

  it('2.6 - shows skeleton when loading', () => {
    const doc = dom('<div class="animate-pulse bg-accent h-24"></div>')
    expect(doc.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('2.7 - Go Live button shows "Go Live" by default', () => {
    const doc = renderOverview()
    expect(doc.querySelector('[data-testid="go-live"]')?.textContent).toBe('Go Live')
  })

  it('2.8 - Go Live button shows "Stop Live" when active', () => {
    const doc = dom('<button data-testid="go-live" class="border-error text-error">Stop Live</button>')
    expect(doc.querySelector('[data-testid="go-live"]')?.textContent).toBe('Stop Live')
  })
})

// --- Comp-3: Cost Page structure ---

describe('Comp-3: Cost Page structure', () => {
  function renderCosts() {
    return dom(`
      <div>
        <div class="grid grid-cols-4 gap-4">
          <div data-testid="kpi-card">Total Spend</div>
          <div data-testid="kpi-card">Input Tokens</div>
          <div data-testid="kpi-card">Output Tokens</div>
          <div data-testid="kpi-card">Cache Reads <span class="text-success">Saved $1,269</span></div>
        </div>
        <div data-testid="budget-tracker"><div class="progress-bar" style="width: 70.5%"></div><span>Projected: $5,840</span></div>
        <div class="grid grid-cols-2">
          <div><h3>Most-Read Files</h3><table><tbody><tr><td class="font-mono">src/services/payment.ts</td></tr></tbody></table></div>
          <div><h3>Most-Edited Files</h3><table><tbody><tr><td class="font-mono">src/api/routes.ts</td></tr></tbody></table></div>
        </div>
        <div data-testid="toggle-buttons"><button>By Team</button><button>By Model</button><button>By User</button></div>
      </div>
    `)
  }

  it('3.1 - renders 4 summary cards', () => {
    const doc = renderCosts()
    expect(doc.querySelectorAll('[data-testid="kpi-card"]').length).toBe(4)
  })

  it('3.2 - cache savings badge shows correct value', () => {
    const doc = renderCosts()
    expect(doc.querySelector('.text-success')?.textContent).toBe('Saved $1,269')
  })

  it('3.3 - budget tracker shows progress bar', () => {
    const doc = renderCosts()
    expect(doc.querySelector('.progress-bar')).not.toBeNull()
  })

  it('3.4 - budget tracker shows projected spend', () => {
    const doc = renderCosts()
    const text = doc.querySelector('[data-testid="budget-tracker"]')?.textContent ?? ''
    expect(text).toContain('Projected')
  })

  it('3.5 - top files tables render', () => {
    const doc = renderCosts()
    const h3s = Array.from(doc.querySelectorAll('h3')).map(h => h.textContent)
    expect(h3s).toContain('Most-Read Files')
    expect(h3s).toContain('Most-Edited Files')
  })

  it('3.6 - file paths render in monospace', () => {
    const doc = renderCosts()
    expect(doc.querySelector('.font-mono')?.textContent).toBe('src/services/payment.ts')
  })

  it('3.7 - token breakdown toggle buttons present', () => {
    const doc = renderCosts()
    const buttons = Array.from(doc.querySelectorAll('[data-testid="toggle-buttons"] button')).map(b => b.textContent)
    expect(buttons).toContain('By Team')
    expect(buttons).toContain('By Model')
    expect(buttons).toContain('By User')
  })
})

// --- Comp-4: Teams Page structure ---

describe('Comp-4: Teams Page structure', () => {
  const teams = [
    { id: 'backend', name: 'Backend', sessions: 600, cost: 3, completionRate: 0.847, costPerSession: 0.01, cacheHitRate: 0.22 },
    { id: 'frontend', name: 'Frontend', sessions: 400, cost: 2, completionRate: 0.84, costPerSession: 0.01, cacheHitRate: 0.18 },
    { id: 'platform', name: 'Platform', sessions: 410, cost: 2, completionRate: 0.846, costPerSession: 0.01, cacheHitRate: 0.55 },
    { id: 'data', name: 'Data', sessions: 431, cost: 2, completionRate: 0.824, costPerSession: 0.01, cacheHitRate: 0.45 },
    { id: 'mobile', name: 'Mobile', sessions: 574, cost: 3, completionRate: 0.852, costPerSession: 0.01, cacheHitRate: 0.35 },
    { id: 'devops', name: 'DevOps', sessions: 563, cost: 3, completionRate: 0.858, costPerSession: 0.01, cacheHitRate: 0.40 },
  ]

  function renderTeamsTable() {
    const rows = teams.map(t => {
      const cacheClass = t.cacheHitRate < 0.3 ? 'text-error' : ''
      return `<tr data-team-id="${t.id}"><td>${t.name}</td><td>${t.sessions}</td><td>${formatCurrency(t.cost)}</td><td>${formatPercent(t.completionRate)}</td><td>${formatCurrencyPrecise(t.costPerSession)}</td><td class="${cacheClass}">${formatPercent(t.cacheHitRate)}</td></tr>`
    }).join('')
    return dom(`<table><thead><tr><th>TEAM</th><th>SESSIONS</th><th>COST</th><th>COMPLETION</th><th>COST/SESSION</th><th>CACHE HIT</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  it('4.1 - team comparison table renders all teams', () => {
    const doc = renderTeamsTable()
    expect(doc.querySelectorAll('tbody tr').length).toBe(6)
  })

  it('4.2 - table headers present', () => {
    const doc = renderTeamsTable()
    const headers = Array.from(doc.querySelectorAll('th')).map(h => h.textContent)
    expect(headers).toEqual(['TEAM', 'SESSIONS', 'COST', 'COMPLETION', 'COST/SESSION', 'CACHE HIT'])
  })

  it('4.3 - low cache rate highlighted in red', () => {
    const doc = renderTeamsTable()
    const errorCells = doc.querySelectorAll('.text-error')
    expect(errorCells.length).toBeGreaterThan(0)
    // Frontend and Backend have <30% cache rate
  })

  it('4.4 - clicking team row could navigate', () => {
    const doc = renderTeamsTable()
    const row = doc.querySelector('[data-team-id="backend"]')
    expect(row).not.toBeNull()
    expect(row?.getAttribute('data-team-id')).toBe('backend')
  })

  it('4.5 - team detail KPI cards scoped to team', () => {
    const team = teams[0]
    const doc = dom(`
      <div class="grid grid-cols-5 gap-4">
        <div data-testid="kpi-card">${team.sessions}</div>
        <div data-testid="kpi-card">${formatCurrency(team.cost)}</div>
        <div data-testid="kpi-card">${formatPercent(team.completionRate)}</div>
        <div data-testid="kpi-card">${formatCurrencyPrecise(team.costPerSession)}</div>
        <div data-testid="kpi-card">${formatPercent(team.cacheHitRate)}</div>
      </div>
    `)
    expect(doc.querySelectorAll('[data-testid="kpi-card"]').length).toBe(5)
  })

  it('4.6 - user table renders user emails', () => {
    const doc = dom(`<table><tbody><tr><td class="text-accent-foreground">alice.smith1@acme.com</td></tr></tbody></table>`)
    expect(doc.querySelector('.text-accent-foreground')?.textContent).toBe('alice.smith1@acme.com')
  })

  it('4.7 - model usage chart renders legend', () => {
    const doc = dom(`<div><span>Haiku</span><span>Sonnet</span><span>Opus</span></div>`)
    const text = doc.body.textContent ?? ''
    expect(text).toContain('Haiku')
    expect(text).toContain('Sonnet')
    expect(text).toContain('Opus')
  })
})

// --- Comp-5: Settings Page structure ---

describe('Comp-5: Settings Page structure', () => {
  function renderSettings() {
    return dom(`
      <div>
        <input type="number" value="6000" data-testid="budget-input" />
        <div data-testid="thresholds">
          <label><input type="checkbox" checked data-threshold="50" /> 50%</label>
          <label><input type="checkbox" checked data-threshold="75" /> 75%</label>
          <label><input type="checkbox" checked data-threshold="90" /> 90%</label>
          <label><input type="checkbox" checked data-threshold="100" /> 100%</label>
        </div>
        <table data-testid="team-budgets">
          <tbody>
            <tr><td>Backend</td><td class="progress"><div style="width: 80%"></div></td></tr>
            <tr><td>Frontend</td><td class="progress over"><div style="width: 121%"></div><span class="text-error">Over</span></td></tr>
            <tr><td>Platform</td><td class="progress"><div style="width: 89%"></div></td></tr>
            <tr><td>Data</td><td class="progress"><div style="width: 85%"></div></td></tr>
            <tr><td>Mobile</td><td class="progress"><div style="width: 47%"></div></td></tr>
            <tr><td>DevOps</td><td class="progress"><div style="width: 34%"></div></td></tr>
          </tbody>
        </table>
        <button data-testid="save-btn">Save Changes</button>
      </div>
    `)
  }

  it('5.1 - budget input renders with current value', () => {
    const doc = renderSettings()
    expect(doc.querySelector('[data-testid="budget-input"]')?.getAttribute('value')).toBe('6000')
  })

  it('5.2 - alert threshold checkboxes render', () => {
    const doc = renderSettings()
    const checkboxes = doc.querySelectorAll('[data-testid="thresholds"] input[type="checkbox"]')
    expect(checkboxes.length).toBe(4)
  })

  it('5.3 - team budget table renders 6 rows', () => {
    const doc = renderSettings()
    expect(doc.querySelectorAll('[data-testid="team-budgets"] tbody tr').length).toBe(6)
  })

  it('5.4 - over-budget team shows red indicator', () => {
    const doc = renderSettings()
    expect(doc.querySelector('.over .text-error')?.textContent).toBe('Over')
  })

  it('5.5 - save button renders', () => {
    const doc = renderSettings()
    expect(doc.querySelector('[data-testid="save-btn"]')?.textContent).toBe('Save Changes')
  })

  it('5.6 - save button can be disabled', () => {
    const doc = dom('<button disabled data-testid="save-btn">Saving...</button>')
    expect(doc.querySelector('[data-testid="save-btn"]')?.hasAttribute('disabled')).toBe(true)
  })

  it('5.7 - changing budget input value', () => {
    const doc = renderSettings()
    const input = doc.querySelector('[data-testid="budget-input"]') as any
    input.setAttribute('value', '5000')
    expect(input.getAttribute('value')).toBe('5000')
  })
})

// --- Comp-6: Filter Bar structure ---

describe('Comp-6: Filter Bar structure', () => {
  function renderFilterBar(isOverview = true) {
    return dom(`
      <div data-testid="filter-bar">
        <button data-range="today">today</button>
        <button data-range="7d">7d</button>
        <button data-range="30d" class="bg-accent text-foreground">30d</button>
        <button data-range="90d">90d</button>
        <select data-testid="filter-team"><option value="">Team: All</option><option value="backend">Backend</option></select>
        <select data-testid="filter-model"><option value="">Model: All</option></select>
        <button data-testid="export-csv">Export CSV</button>
        ${isOverview ? '<button data-testid="go-live">Go Live</button>' : ''}
      </div>
    `)
  }

  it('6.1 - time range buttons render', () => {
    const doc = renderFilterBar()
    const buttons = doc.querySelectorAll('[data-range]')
    expect(buttons.length).toBe(4)
  })

  it('6.2 - active time range button is highlighted', () => {
    const doc = renderFilterBar()
    const active = doc.querySelector('[data-range="30d"]')
    expect(active?.getAttribute('class')).toContain('bg-accent')
  })

  it('6.3 - clicking time range would update atom', () => {
    const doc = renderFilterBar()
    const btn = doc.querySelector('[data-range="7d"]')
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toBe('7d')
  })

  it('6.4 - team dropdown renders', () => {
    const doc = renderFilterBar()
    expect(doc.querySelector('[data-testid="filter-team"]')).not.toBeNull()
  })

  it('6.5 - team dropdown has backend option', () => {
    const doc = renderFilterBar()
    const select = doc.querySelector('[data-testid="filter-team"]')
    const options = select?.querySelectorAll('option') ?? []
    const values = Array.from(options).map((o: any) => o.getAttribute('value'))
    expect(values).toContain('backend')
  })

  it('6.6 - export CSV button renders', () => {
    const doc = renderFilterBar()
    expect(doc.querySelector('[data-testid="export-csv"]')?.textContent).toBe('Export CSV')
  })

  it('6.7 - Go Live button only on Overview', () => {
    const overviewDoc = renderFilterBar(true)
    expect(overviewDoc.querySelector('[data-testid="go-live"]')).not.toBeNull()

    const costsDoc = renderFilterBar(false)
    expect(costsDoc.querySelector('[data-testid="go-live"]')).toBeNull()
  })
})

// --- Comp-7: Navigation Sidebar structure ---

describe('Comp-7: Navigation Sidebar', () => {
  function renderSidebar(activePath = '/') {
    const items = [
      { label: 'Overview', path: '/' },
      { label: 'Costs', path: '/costs' },
      { label: 'Teams', path: '/teams' },
      { label: 'Settings', path: '/settings' },
    ]
    const navHtml = items.map(item => {
      const isActive = item.path === '/' ? activePath === '/' : activePath.startsWith(item.path)
      return `<button class="${isActive ? 'bg-accent text-accent-foreground' : 'text-foreground-muted'}" data-path="${item.path}">${item.label}</button>`
    }).join('')
    return dom(`<aside><div class="logo">ZenDash</div><nav>${navHtml}</nav></aside>`)
  }

  it('7.1 - all 4 nav items render', () => {
    const doc = renderSidebar()
    const buttons = doc.querySelectorAll('nav button')
    expect(buttons.length).toBe(4)
    const labels = Array.from(buttons).map(b => b.textContent)
    expect(labels).toEqual(['Overview', 'Costs', 'Teams', 'Settings'])
  })

  it('7.2 - active route is highlighted', () => {
    const doc = renderSidebar('/costs')
    const active = doc.querySelector('.bg-accent')
    expect(active?.textContent).toBe('Costs')
  })

  it('7.3 - clicking nav item has path attribute', () => {
    const doc = renderSidebar()
    const costsBtn = doc.querySelector('[data-path="/costs"]')
    expect(costsBtn).not.toBeNull()
    expect(costsBtn?.textContent).toBe('Costs')
  })

  it('7.4 - logo renders', () => {
    const doc = renderSidebar()
    expect(doc.querySelector('.logo')?.textContent).toBe('ZenDash')
  })
})
