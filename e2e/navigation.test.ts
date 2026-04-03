import { test, expect } from '@playwright/test'

// --- E2E-7: CSV Export ---

test.describe('E2E-7: CSV Export', () => {
  test('7.1 - export button present', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    await expect(page.locator('button', { hasText: 'Export CSV' })).toBeVisible()
  })
})

// --- E2E-8: Navigation & URL ---

test.describe('E2E-8: Navigation & URL', () => {
  test('8.1 - direct URL to Costs works', async ({ page }) => {
    await page.goto('/costs')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 10_000 })
    await expect(page.locator('text=Cost & Usage')).toBeVisible()
  })

  test('8.2 - direct URL to Teams works', async ({ page }) => {
    await page.goto('/teams')
    await page.waitForSelector('table', { timeout: 10_000 })
    // Page title "Teams" should be visible
    const heading = page.locator('h1', { hasText: 'Teams' })
    await expect(heading).toBeVisible()
  })

  test('8.3 - direct URL to Settings works', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForSelector('input[type="number"]', { timeout: 10_000 })
    const heading = page.locator('h1', { hasText: 'Settings' })
    await expect(heading).toBeVisible()
  })

  test('8.4 - unknown URL shows overview', async ({ page }) => {
    await page.goto('/nonexistent')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 10_000 })
    const heading = page.locator('h1', { hasText: 'Overview' })
    await expect(heading).toBeVisible()
  })

  test('8.5 - browser back/forward works', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    // Navigate: Overview → Costs
    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('text=Cost & Usage', { timeout: 5000 })

    // Navigate: Costs → Teams
    await page.locator('aside button', { hasText: 'Teams' }).click()
    await page.waitForSelector('table', { timeout: 5000 })

    // Go back → Costs
    await page.goBack()
    await page.waitForSelector('text=Cost & Usage', { timeout: 5000 })
    await expect(page.locator('text=Cost & Usage')).toBeVisible()

    // Go back → Overview
    await page.goBack()
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 5000 })
    const heading = page.locator('h1', { hasText: 'Overview' })
    await expect(heading).toBeVisible()

    // Go forward → Costs
    await page.goForward()
    await page.waitForSelector('text=Cost & Usage', { timeout: 5000 })
    await expect(page.locator('text=Cost & Usage')).toBeVisible()
  })
})

// --- E2E-9: Performance ---

test.describe('E2E-9: Performance', () => {
  test('9.1 - initial load under 5 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })

  test('9.2 - filter response under 2 seconds', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    const start = Date.now()
    await page.locator('button', { hasText: '7d' }).first().click()
    await page.waitForTimeout(500)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000)
  })

  test('9.3 - navigation is fast', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    const start = Date.now()
    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('[class*="font-semibold"]')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(3000)
  })
})

// --- E2E-10: Accessibility ---

test.describe('E2E-10: Accessibility', () => {
  test('10.1 - interactive elements are keyboard-reachable', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT', 'SELECT']).toContain(focused)
  })

  test('10.2 - sidebar nav items are focusable buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    const navButtons = page.locator('aside button')
    const count = await navButtons.count()
    expect(count).toBe(4)

    for (let i = 0; i < count; i++) {
      const tag = await navButtons.nth(i).evaluate(el => el.tagName)
      expect(tag).toBe('BUTTON')
    }
  })
})
