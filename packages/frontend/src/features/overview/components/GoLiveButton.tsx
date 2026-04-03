import { reatomComponent } from '@reatom/react'
import { isLive, toggleLive } from '../model'
import { cn } from '../../../shared/utils/cn'

export const GoLiveButton = reatomComponent(() => {
  const live = isLive()

  return (
    <button
      onClick={() => toggleLive()}
      className={cn(
        'flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors',
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
