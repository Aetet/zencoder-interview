import { cn } from '../utils/cn'

interface ProgressBarProps {
  value: number // 0-1
  color?: string
  markers?: number[] // 0-1 positions
  height?: string
}

export function ProgressBar({ value, color = 'bg-primary', markers, height = 'h-2' }: ProgressBarProps) {
  return (
    <div className="relative">
      <div className={cn('w-full bg-accent rounded-full overflow-hidden', height)}>
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
      {markers?.map((pos) => (
        <div
          key={pos}
          className="absolute top-0 w-0.5 bg-foreground-muted"
          style={{ left: `${pos * 100}%`, height: '100%' }}
        />
      ))}
    </div>
  )
}
