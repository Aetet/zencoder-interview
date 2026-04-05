import { useState } from 'react'
import { cn } from '../utils/cn'

interface CollapsibleListProps<T> {
  items: T[]
  visibleCount?: number
  renderItem: (item: T, index: number) => React.ReactNode
  keyFn: (item: T) => string
  label?: string
}

export function CollapsibleList<T>({
  items,
  visibleCount = 5,
  renderItem,
  keyFn,
  label = 'items',
}: CollapsibleListProps<T>) {
  const [expanded, setExpanded] = useState(false)

  const top = items.slice(0, visibleCount)
  const rest = items.slice(visibleCount)

  return (
    <>
      {top.map((item, i) => (
        <div key={keyFn(item)}>{renderItem(item, i)}</div>
      ))}

      {rest.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-accent-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className={cn(
              'inline-block transition-transform duration-200',
              expanded ? 'rotate-90' : 'rotate-0',
            )}>
              ▸
            </span>
            {expanded ? 'Show less' : `and ${rest.length} more ${label}...`}
          </button>

          <div className={cn('fold-enter', expanded && 'fold-open')}>
            <div className="fold-inner">
              <div className="mt-2 ml-4 pl-3 border-l-2 border-border space-y-0">
                {rest.map((item, i) => (
                  <div key={keyFn(item)}>{renderItem(item, visibleCount + i)}</div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
