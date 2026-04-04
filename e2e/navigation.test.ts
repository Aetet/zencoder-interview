import { test, expect } from '@playwright/test'

test.describe('E2E-7: CSV Export', () => {
  test('7.1 - export button present', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
    await expect(page.locator('button', { hasText: 'Export CSV' })).toBeVisible()
  })
})

test.describe('E2E-8: Navigation & URL', () => {
  test('8.1 - navigate to Costs via sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('text=Token Spend Over Time', { timeout: 30_000 })
    const labels = page.locator('[class*="uppercase"][class*="tracking"]')
    const count = await labels.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('8.2 - navigate to Teams via sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
    await page.locator('aside button', { hasText: 'Teams' }).click()
    await page.waitForSelector('text=All Teams', { timeout: 30_000 })
    await expect(page.locator('h1', { hasText: 'All Teams' })).toBeVisible()
  })

  test('8.3 - navigate to Alerts via sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
    await page.locator('aside button', { hasText: 'Alerts' }).click()
    await page.waitForSelector('text=Notifications & Alerts', { timeout: 30_000 })
    await expect(page.locator('h1', { hasText: 'Notifications & Alerts' })).toBeVisible()
  })

  test('8.4 - unknown URL shows overview', async ({ page }) => {
    await page.goto('/nonexistent')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
    await expect(page.locator('h1', { hasText: 'Overview' })).toBeVisible()
  })

  test('8.5 - browser back/forward works', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })

    // Overview → Costs
    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('text=Token Spend Over Time', { timeout: 30_000 })

    // Costs → Teams
    await page.locator('aside button', { hasText: 'Teams' }).click()
    await page.waitForSelector('text=All Teams', { timeout: 30_000 })

    // Back → Costs
    await page.goBack()
    await page.waitForSelector('text=Token Spend Over Time', { timeout: 20_000 })

    // Back → Overview
    await page.goBack()
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 20_000 })
    await expect(page.locator('h1', { hasText: 'Overview' })).toBeVisible()

    // Forward → Costs
    await page.goForward()
    await page.waitForSelector('text=Token Spend Over Time', { timeout: 20_000 })
  })
})

test.describe('E2E-9: Performance', () => {
  test('9.1 - initial load under 5 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 20_000 })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })

  test('9.2 - filter response under 2 seconds', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })

    const start = Date.now()
    await page.locator('button', { hasText: '7d' }).first().click()
    await page.waitForTimeout(500)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000)
  })

  test('9.3 - navigation is fast', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })

    const start = Date.now()
    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 20_000 })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(3000)
  })
})

test.describe('E2E-10: Accessibility', () => {
  test('10.1 - interactive elements are keyboard-reachable', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })

    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT', 'SELECT']).toContain(focused)
  })

  test('10.2 - sidebar nav items are focusable buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })

    const navButtons = page.locator('aside button')
    const count = await navButtons.count()
    expect(count).toBe(4)

    for (let i = 0; i < count; i++) {
      const tag = await navButtons.nth(i).evaluate(el => el.tagName)
      expect(tag).toBe('BUTTON')
    }
  })
})
