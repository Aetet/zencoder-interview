import { cn } from '../utils/cn'

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-6', className)}>
      {children}
    </div>
  )
}
