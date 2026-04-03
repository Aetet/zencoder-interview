import { useRef, useEffect, useState } from 'react'
import { Card } from './Card'
import { cn } from '../utils/cn'

interface KpiCardProps {
  label: string
  value: string
  delta?: string
  deltaType?: 'positive' | 'negative' | 'neutral'
  live?: boolean
}

export function KpiCard({ label, value, delta, deltaType = 'neutral', live }: KpiCardProps) {
  const [flash, setFlash] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (live && prevValue.current !== value) {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 400)
      prevValue.current = value
      return () => clearTimeout(timer)
    }
  }, [value, live])

  return (
    <Card className={cn('py-5 px-6', flash && 'live-card')}>
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted mb-2">
        {label}
        {live && (
          <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
        )}
      </div>
      <div className={cn('text-[28px] font-semibold text-foreground tabular-nums leading-tight', live && 'live-value')}>
        {value}
      </div>
      {delta && (
        <div className={cn(
          'text-xs mt-1',
          deltaType === 'positive' && 'text-success',
          deltaType === 'negative' && 'text-error',
          deltaType === 'neutral' && 'text-foreground-muted',
        )}>
          {delta}
        </div>
      )}
    </Card>
  )
}
