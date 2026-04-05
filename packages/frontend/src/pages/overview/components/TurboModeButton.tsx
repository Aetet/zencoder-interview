import { reatomComponent } from '@reatom/react'
import { overviewRoute } from '../overview-route'
import { cn } from '../../../shared/utils/cn'

export const TurboModeButton = reatomComponent(() => {
  const turbo = overviewRoute.isTurbo()

  return (
    <button
      onClick={() => overviewRoute.toggleTurbo()}
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer',
        turbo
          ? 'border border-warning text-warning hover:bg-warning/10'
          : 'border border-border text-foreground-secondary hover:bg-card',
      )}
    >
      <span className={cn(
        'w-2 h-2 rounded-full',
        turbo ? 'bg-warning animate-pulse' : 'bg-foreground-muted',
      )} />
      {turbo ? 'Stop Turbo' : 'Turbo (No DB)'}
    </button>
  )
}, 'TurboModeButton')
