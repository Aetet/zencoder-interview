import { useState, useEffect, useRef } from 'react'
import { reatomComponent } from '@reatom/react'
import { isSomeLoaderPending } from '@reatom/core'

export const GlobalProgress = reatomComponent(() => {
  const pending = isSomeLoaderPending()
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (pending) {
      timerRef.current = setTimeout(() => setVisible(true), 500)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      setVisible(false)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [pending])

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      {visible && (
        <div className="h-full bg-primary animate-progress" />
      )}
    </div>
  )
}, 'GlobalProgress')
