import { test, expect } from '@playwright/test'

test.describe('E2E-4: Filter Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]', { timeout: 30_000 })
  })

  test('4.3 - filter bar has team selector', async ({ page }) => {
    // Filter bar should have a Team dropdown/select
    const filterBar = page.locator('text=Team').first()
    await expect(filterBar).toBeVisible()
  })
})
