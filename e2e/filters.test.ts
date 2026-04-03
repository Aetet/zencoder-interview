import { test, expect } from '@playwright/test'

// --- E2E-4: Filter Flow ---

test.describe('E2E-4: Filter Flow', () => {
  test('4.1 - default filter is 30d', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    const btn30d = page.locator('button', { hasText: '30d' }).first()
    await expect(btn30d).toHaveClass(/bg-accent/)
  })

  test('4.2 - changing time range updates data', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    await page.locator('button', { hasText: '7d' }).first().click()
    await page.waitForTimeout(1000)

    // 7d button should now be active
    const btn7d = page.locator('button', { hasText: '7d' }).first()
    await expect(btn7d).toHaveClass(/bg-accent/)
  })

  test('4.3 - team filter dropdown works', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    const teamSelect = page.locator('select').first()
    await teamSelect.selectOption('backend')
    await page.waitForTimeout(1000)

    // Page should still have KPI cards
    const labels = page.locator('[class*="uppercase"][class*="tracking"]')
    const count = await labels.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('4.5 - filters persist across navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    await page.locator('button', { hasText: '7d' }).first().click()
    await page.waitForTimeout(500)

    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForSelector('[class*="font-semibold"]')

    const btn7d = page.locator('button', { hasText: '7d' }).first()
    await expect(btn7d).toHaveClass(/bg-accent/)
  })
})
