import { test, expect } from '@playwright/test'

test.describe('E2E-6: Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('aside button', { hasText: 'Alerts' }).click()
    await page.waitForSelector('text=Notifications & Alerts', { timeout: 30_000 })
  })

  test('6.1 - alerts page loads', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Notifications & Alerts' })).toBeVisible()
  })

  test('6.2 - alert thresholds render with toggles', async ({ page }) => {
    await expect(page.locator('text=Alert Thresholds')).toBeVisible()
    const toggles = page.locator('[class*="rounded-full"][class*="relative"]')
    const count = await toggles.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('6.3 - alert delivery section visible', async ({ page }) => {
    await expect(page.locator('text=Alert Delivery')).toBeVisible()
    await expect(page.locator('text=Email notifications')).toBeVisible()
  })

  test('6.4 - anomaly detection section visible', async ({ page }) => {
    await expect(page.locator('text=Anomaly Detection')).toBeVisible()
  })

  test('6.5 - alert history section visible', async ({ page }) => {
    await expect(page.locator('text=Alert History')).toBeVisible()
  })
})
