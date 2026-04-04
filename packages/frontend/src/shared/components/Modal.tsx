import { cn } from '../utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className={cn(
          'relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-5',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-foreground-secondary">{title}</h2>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground text-lg leading-none cursor-pointer"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
