import { memo } from 'react'

export const CoinsIcon = memo(function CoinsIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Stacked coins */}
      <ellipse cx="9" cy="8" rx="6" ry="2.5" />
      <path d="M3 8v2c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V8" />
      <path d="M3 10v2c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5v-2" />
      <path d="M3 12v2c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5v-2" />
      {/* Coin on edge, leaning right */}
      <ellipse cx="18.5" cy="12" rx="1.8" ry="5.5" transform="rotate(-15 18.5 12)" />
    </svg>
  )
})
