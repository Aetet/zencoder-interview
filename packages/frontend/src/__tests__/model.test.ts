import { describe, it, expect } from 'vitest'
import { atom, reatomBoolean } from '@reatom/core'
import { cn } from '../shared/utils/cn'

describe('overview model', () => {
  it('isLive defaults to false', () => {
    const isLive = reatomBoolean(false, 'test.isLive')
    expect(isLive()).toBe(false)
  })

  it('isLive.setTrue changes to true', () => {
    const isLive = reatomBoolean(false, 'test2.isLive')
    isLive.setTrue()
    expect(isLive()).toBe(true)
  })

  it('isLive.setFalse changes to false', () => {
    const isLive = reatomBoolean(true, 'test3.isLive')
    isLive.setFalse()
    expect(isLive()).toBe(false)
  })

  it('isLive.toggle flips state', () => {
    const isLive = reatomBoolean(false, 'test4.isLive')
    isLive.toggle()
    expect(isLive()).toBe(true)
    isLive.toggle()
    expect(isLive()).toBe(false)
  })
})

describe('overview loading', () => {
  it('loading defaults to true', () => {
    const loading = atom(true, 'test.loading')
    expect(loading()).toBe(true)
  })

  it('loading can be set to false', () => {
    const loading = atom(true, 'test2.loading')
    loading.set(false)
    expect(loading()).toBe(false)
  })
})

describe('cn utility', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('filters falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('handles empty', () => {
    expect(cn()).toBe('')
  })
})
