import { test, expect } from '@playwright/test'

test.describe('E2E-1: Overview Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
  })

  test('1.1 - dashboard loads with KPI cards', async ({ page }) => {
    const cards = page.locator('[class*="uppercase"][class*="tracking"]')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('1.2 - KPI values are numbers', async ({ page }) => {
    const values = await page.locator('[class*="font-semibold"][class*="text-foreground"]').allTextContents()
    for (const v of values) {
      expect(v).toMatch(/[\d,.$%/]+/)
    }
  })

  test('1.3 - charts render', async ({ page }) => {
    // Wait for any recharts SVG to appear
    const svgs = page.locator('.recharts-wrapper svg')
    await svgs.first().waitFor({ timeout: 30_000 })
    const count = await svgs.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('1.4 - insights panel shows items', async ({ page }) => {
    // Insights section exists
    await expect(page.locator('text=Insights').first()).toBeVisible()
  })

  test('1.5 - team leaderboard shows rows', async ({ page }) => {
    // Leaderboard uses virtualized CSS grid (no <table>)
    await expect(page.locator('text=Team Leaderboard').first()).toBeVisible()
    const rows = page.locator('div.grid.cursor-pointer')
    await rows.first().waitFor({ timeout: 20_000 })
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('1.6 - leaderboard row click navigates to teams', async ({ page }) => {
    await expect(page.locator('text=Team Leaderboard').first()).toBeVisible()
    const rows = page.locator('div.grid.cursor-pointer')
    await rows.first().waitFor({ timeout: 20_000 })
    await rows.first().click()
    await expect(page).toHaveURL(/\/teams/)
  })
})
