import { cn } from '../utils/cn'

export function Card({ children, className, title, onClick }: { children: React.ReactNode; className?: string; title?: string; onClick?: () => void }) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-6', className)} title={title} onClick={onClick}>
      {children}
    </div>
  )
}
