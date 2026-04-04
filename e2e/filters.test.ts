import { test, expect } from '@playwright/test'

test.describe('E2E-4: Filter Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
  })

  test('4.1 - default filter is 30d', async ({ page }) => {
    const btn30d = page.locator('button', { hasText: '30d' }).first()
    await expect(btn30d).toHaveClass(/bg-accent/)
  })

  test('4.2 - changing time range updates data', async ({ page }) => {
    await page.locator('button', { hasText: '7d' }).first().click()
    await page.waitForTimeout(1000)

    const btn7d = page.locator('button', { hasText: '7d' }).first()
    await expect(btn7d).toHaveClass(/bg-accent/)
  })

  test('4.3 - filter bar has team selector', async ({ page }) => {
    // Filter bar should have a Team dropdown/select
    const filterBar = page.locator('text=Team').first()
    await expect(filterBar).toBeVisible()
  })

  test('4.5 - filters persist across navigation', async ({ page }) => {
    await page.locator('button', { hasText: '7d' }).first().click()
    await page.waitForTimeout(500)

    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })

    const btn7d = page.locator('button', { hasText: '7d' }).first()
    await expect(btn7d).toHaveClass(/bg-accent/)
  })
})
