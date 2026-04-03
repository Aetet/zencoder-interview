import { reatomComponent } from '@reatom/react'
import { timeRange, teamFilter, modelFilter } from '../filters/model'
import { currentPath } from '../../routes'
import { cn } from '../utils/cn'

const TIME_RANGES = ['today', '7d', '30d', '90d']

export const FilterBar = reatomComponent(() => {
  const active = timeRange()
  const path = currentPath()
  const isOverview = path === '/'

  return (
    <div className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => timeRange.set(r)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-[13px] transition-colors',
              active === r
                ? 'bg-accent text-foreground font-medium'
                : 'text-foreground-muted hover:text-foreground',
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      <select
        value={teamFilter()}
        onChange={(e) => teamFilter.set(e.target.value)}
        className="bg-transparent text-foreground-muted text-xs border-none outline-none cursor-pointer"
      >
        <option value="">Team: All</option>
        <option value="backend">Backend</option>
        <option value="frontend">Frontend</option>
        <option value="platform">Platform</option>
        <option value="data">Data</option>
        <option value="mobile">Mobile</option>
        <option value="devops">DevOps</option>
      </select>

      <select
        value={modelFilter()}
        onChange={(e) => modelFilter.set(e.target.value)}
        className="bg-transparent text-foreground-muted text-xs border-none outline-none cursor-pointer"
      >
        <option value="">Model: All</option>
        <option value="haiku">Haiku</option>
        <option value="sonnet">Sonnet</option>
        <option value="opus">Opus</option>
      </select>

      <div className="ml-auto flex items-center gap-2">
        {isOverview && <div id="go-live-slot" />}
        <button className="px-3 py-1.5 rounded-xl text-xs text-foreground-muted border border-border hover:bg-accent transition-colors">
          Export CSV
        </button>
      </div>
    </div>
  )
}, 'FilterBar')
