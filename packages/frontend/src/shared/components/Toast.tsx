import { atom, action } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { cn } from '../utils/cn'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let nextId = 0
export const toasts = atom<ToastItem[]>([], 'toast.list')

export const showToast = action((message: string, type: ToastItem['type'] = 'success') => {
  const id = nextId++
  toasts.set((prev) => [...prev, { id, message, type }])
  setTimeout(() => {
    toasts.set((prev) => prev.filter((t) => t.id !== id))
  }, 3000)
}, 'toast.show')

const typeStyles = {
  success: 'border-l-success',
  error: 'border-l-error',
  info: 'border-l-accent-foreground',
}

export const ToastContainer = reatomComponent(() => {
  const items = toasts()
  if (items.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'bg-card border border-border border-l-4 rounded-lg px-4 py-3 shadow-2xl',
            'text-sm text-foreground animate-[slideIn_0.2s_ease-out]',
            typeStyles[t.type],
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}, 'ToastContainer')
