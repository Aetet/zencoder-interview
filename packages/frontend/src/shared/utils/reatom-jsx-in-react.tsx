import { useRef, useEffect } from 'react'
import { mount } from '@reatom/jsx'

/**
 * Wraps a reatom/jsx element builder into a React component.
 *
 * Usage:
 *   // in .reatom.tsx
 *   export function buildMyWidget(): HTMLElement { return <div>...</div> }
 *
 *   // in .tsx
 *   export const MyWidget = r(buildMyWidget)
 */
export function r(
  build: () => HTMLElement,
  displayName?: string,
): React.FC {
  const Component: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!ref.current) return
      const el = build()
      const handle = mount(ref.current, el as any)
      return () => handle.unmount()
    }, [])

    return <div ref={ref} />
  }

  Component.displayName = displayName ?? build.name ?? 'ReatomJsxBridge'
  return Component
}
