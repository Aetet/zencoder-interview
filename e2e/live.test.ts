import { test, expect } from '@playwright/test'

test.describe('E2E-2: Live & Turbo Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
  })

  test('2.1 - overview is live by default', async ({ page }) => {
    await expect(page.locator('text=LIVE')).toBeVisible()
  })

  test('2.2 - Turbo button visible', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Turbo (No DB)' })).toBeVisible()
  })

  test('2.3 - clicking Turbo activates turbo mode', async ({ page }) => {
    await page.locator('button', { hasText: 'Turbo (No DB)' }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('button', { hasText: 'Stop Turbo' })).toBeVisible()
    await expect(page.locator('span', { hasText: /^TURBO$/ })).toBeVisible()
  })

  test('2.4 - Stop Turbo returns to live', async ({ page }) => {
    await page.locator('button', { hasText: 'Turbo (No DB)' }).click()
    await page.waitForTimeout(500)
    await page.locator('button', { hasText: 'Stop Turbo' }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=LIVE')).toBeVisible()
  })

  test('2.5 - KPIs present in live mode', async ({ page }) => {
    const values = page.locator('[class*="font-semibold"][class*="text-foreground"]')
    const count = await values.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })
})
