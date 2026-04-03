import { cn } from '../utils/cn'

interface BadgeProps {
  variant: 'success' | 'error' | 'warning' | 'info'
  children: React.ReactNode
}

const variants = {
  success: 'bg-success/20 text-success',
  error: 'bg-error/20 text-error',
  warning: 'bg-warning/20 text-warning',
  info: 'bg-accent text-foreground-muted',
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium', variants[variant])}>
      {children}
    </span>
  )
}
