import { useState } from 'react'
import { reatomComponent } from '@reatom/react'
import { teamsRoute, teamRoute } from '../teams-route'
import { cn } from '../../../shared/utils/cn'

const VISIBLE_TABS = 10

export const TeamTabs = reatomComponent(() => {
  const teams = teamsRoute.teamsList()
  const selectedId = teamRoute.selectedTeamId()
  const [expanded, setExpanded] = useState(false)

  const top = teams.slice(0, VISIBLE_TABS)
  const rest = teams.slice(VISIBLE_TABS)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => teamsRoute.go({})}
          className={cn(
            'px-3 py-1.5 rounded-xl text-[13px] transition-colors cursor-pointer',
            !selectedId ? 'bg-accent text-foreground font-medium' : 'text-foreground-muted hover:text-foreground',
          )}
        >
          All Teams
        </button>
        {top.map(t => (
          <TabButton key={t.id} id={t.id} name={t.name} isActive={selectedId === t.id} />
        ))}
        {rest.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 text-[13px] text-accent-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className={cn(
              'inline-block transition-transform duration-200',
              expanded ? 'rotate-90' : 'rotate-0',
            )}>
              ▸
            </span>
            {expanded ? 'Show less' : `and ${rest.length} more teams...`}
          </button>
        )}
      </div>

      {rest.length > 0 && (
        <div className={cn('fold-enter', expanded && 'fold-open')}>
          <div className="fold-inner">
            <div className="flex gap-2 flex-wrap items-center pt-1">
              {rest.map(t => (
                <TabButton key={t.id} id={t.id} name={t.name} isActive={selectedId === t.id} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}, 'TeamTabs')

function TabButton({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  return (
    <button
      onClick={() => teamRoute.go({ teamId: id })}
      className={cn(
        'px-3 py-1.5 rounded-xl text-[13px] transition-colors cursor-pointer',
        isActive
          ? 'bg-accent text-foreground font-medium'
          : 'text-foreground-muted hover:text-foreground',
      )}
    >
      {name}
    </button>
  )
}
