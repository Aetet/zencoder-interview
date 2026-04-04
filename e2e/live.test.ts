import { test, expect } from '@playwright/test'

test.describe('E2E-2: Go Live Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
  })

  test('2.1 - Go Live button visible', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Go Live' })).toBeVisible()
  })

  test('2.2 - clicking activates live mode', async ({ page }) => {
    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('button', { hasText: 'Stop Live' })).toBeVisible()
  })

  test('2.3 - KPIs present in live mode', async ({ page }) => {
    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(2000)

    const values = page.locator('[class*="font-semibold"][class*="text-foreground"]')
    const count = await values.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('2.4 - Stop Live returns to static', async ({ page }) => {
    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(500)
    await page.locator('button', { hasText: 'Stop Live' }).click()
    await page.waitForTimeout(200)
    await expect(page.locator('button', { hasText: 'Go Live' })).toBeVisible()
  })

  test('2.5 - live mode stops on navigation', async ({ page }) => {
    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(500)

    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForTimeout(1000)

    await page.locator('aside button', { hasText: 'Overview' }).click()
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 20_000 })
    await expect(page.locator('button', { hasText: 'Go Live' })).toBeVisible()
  })
})
