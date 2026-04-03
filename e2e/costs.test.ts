import { test, expect } from '@playwright/test'

// --- E2E-3: Cost Analysis Journey ---

test.describe('E2E-3: Cost Analysis Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 10_000 })
  })

  test('3.1 - costs page loads with summary cards', async ({ page }) => {
    await expect(page.locator('text=Cost & Usage')).toBeVisible()
    const labels = page.locator('[class*="uppercase"][class*="tracking"]')
    const count = await labels.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('3.2 - token breakdown chart renders', async ({ page }) => {
    await expect(page.locator('text=Token Spend Over Time')).toBeVisible()
  })

  test('3.3 - cache efficiency panel shows rate', async ({ page }) => {
    await expect(page.locator('text=Cache Efficiency')).toBeVisible()
    // The SVG gauge circle should be present
    const svgCircle = page.locator('svg circle')
    const count = await svgCircle.count()
    expect(count).toBeGreaterThanOrEqual(2) // bg ring + filled ring
  })

  test('3.4 - budget tracker shows progress', async ({ page }) => {
    await expect(page.locator('text=Budget Tracker')).toBeVisible()
    await expect(page.locator('text=Projected')).toBeVisible()
  })

  test('3.5 - top files tables show data', async ({ page }) => {
    await expect(page.locator('text=Most-Read Files')).toBeVisible()
    await expect(page.locator('text=Most-Edited Files')).toBeVisible()
    const monoCells = page.locator('[class*="font-mono"]')
    const count = await monoCells.count()
    expect(count).toBeGreaterThan(0)
  })
})
