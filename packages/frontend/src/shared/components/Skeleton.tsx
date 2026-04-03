import { cn } from '../utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-accent animate-pulse rounded-lg', className)} />
}
