import { useEffect, useRef } from 'react'
import { cn } from '../utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const mouseDownTarget = useRef<EventTarget | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={(e) => { mouseDownTarget.current = e.target }}
      onClick={(e) => {
        // Close if click landed outside the dialog
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)
          && mouseDownTarget.current && !dialogRef.current.contains(mouseDownTarget.current as Node)) {
          onClose()
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={cn(
          'relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-5',
          className,
        )}
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
