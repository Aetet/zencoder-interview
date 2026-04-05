import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyPrecise, formatNumber, formatPercent, formatCompact } from '../shared/utils/format'

describe('formatCurrency', () => {
  it('formats whole dollars', () => {
    expect(formatCurrency(4231)).toBe('$4,231.00')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00')
  })
})

describe('formatCurrencyPrecise', () => {
  it('formats with 2 decimal places', () => {
    expect(formatCurrencyPrecise(0.33)).toBe('$0.33')
  })

  it('pads to 2 decimals', () => {
    expect(formatCurrencyPrecise(1)).toBe('$1.00')
  })
})

describe('formatNumber', () => {
  it('adds commas', () => {
    expect(formatNumber(12847)).toBe('12,847')
  })

  it('handles small numbers', () => {
    expect(formatNumber(42)).toBe('42')
  })
})

describe('formatPercent', () => {
  it('formats as percentage', () => {
    expect(formatPercent(0.873)).toBe('87.3%')
  })

  it('handles 100%', () => {
    expect(formatPercent(1)).toBe('100.0%')
  })

  it('handles 0%', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })
})

describe('formatCompact', () => {
  it('formats millions', () => {
    expect(formatCompact(28400000)).toBe('28.4M')
  })

  it('formats thousands', () => {
    expect(formatCompact(6200)).toBe('6.2K')
  })

  it('returns plain number for small values', () => {
    expect(formatCompact(42)).toBe('42')
  })
})
