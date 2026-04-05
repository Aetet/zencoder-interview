import { notify } from '@reatom/core'
import { cn } from '../utils/cn'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (value: string) => void
}

export function Input({ onChange, className, ...props }: InputProps) {
  return (
    <input
      {...props}
      onChange={(e) => {
        onChange?.(e.target.value)
        notify()
      }}
      className={cn(
        'w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:ring-1 focus:ring-ring',
        className,
      )}
    />
  )
}
