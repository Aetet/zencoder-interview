import { useState, useEffect, startTransition } from 'react'
import { Skeleton } from './Skeleton'

export function DeferredMount({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    startTransition(() => setMounted(true))
  }, [])

  if (!mounted) return fallback ?? <Skeleton className="flex-1" />
  return children
}
