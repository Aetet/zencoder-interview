import { reatomComponent } from '@reatom/react'
import { overviewRoute } from '../overview-model'
import { cn } from '../../../shared/utils/cn'

export const GoLiveButton = reatomComponent(() => {
  const live = overviewRoute.isLive()

  return (
    <button
      onClick={() => overviewRoute.toggleLive()}
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer',
        live
          ? 'border border-error text-error hover:bg-error/10'
          : 'bg-primary text-primary-foreground hover:opacity-90',
      )}
    >
      <span className={cn(
        'w-2 h-2 rounded-full',
        live ? 'bg-error animate-pulse' : 'bg-white',
      )} />
      {live ? 'Stop Live' : 'Go Live'}
    </button>
  )
}, 'GoLiveButton')
