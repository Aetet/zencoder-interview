import { test, expect } from '@playwright/test'

// --- E2E-1: Overview Journey ---

test.describe('E2E-1: Overview Journey', () => {
  test('1.1 - dashboard loads with KPI cards', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 10_000 })
    const cards = page.locator('[class*="uppercase"][class*="tracking"]')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('1.2 - KPI values are numbers', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    const values = await page.locator('[class*="font-semibold"][class*="text-foreground"]').allTextContents()
    for (const v of values) {
      expect(v).toMatch(/[\d,.$%/]+/)
    }
  })

  test('1.3 - charts render SVG', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.recharts-responsive-container', { timeout: 10_000 })
    const charts = page.locator('.recharts-responsive-container')
    const count = await charts.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('1.4 - insights panel shows items', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="border-l-4"]', { timeout: 10_000 })
    const insights = page.locator('[class*="border-l-4"]')
    const count = await insights.count()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(3)
  })

  test('1.5 - team leaderboard shows rows', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('table tbody tr', { timeout: 10_000 })
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('1.6 - leaderboard row click navigates to teams', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('table tbody tr')
    await page.locator('table tbody tr').first().click()
    await expect(page).toHaveURL(/\/teams/)
  })
})
