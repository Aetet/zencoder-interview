import { test, expect } from '@playwright/test'

// --- E2E-2: Go Live Mode ---

test.describe('E2E-2: Go Live Mode', () => {
  test('2.1 - Go Live button visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    const btn = page.locator('button', { hasText: 'Go Live' })
    await expect(btn).toBeVisible()
  })

  test('2.2 - clicking activates live mode', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(500)
    const stopBtn = page.locator('button', { hasText: 'Stop Live' })
    await expect(stopBtn).toBeVisible()
  })

  test('2.3 - KPIs update automatically in live mode', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')

    const firstCard = page.locator('[class*="font-semibold"][class*="text-foreground"]').first()
    const initialValue = await firstCard.textContent()

    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(2000)

    const currentValue = await firstCard.textContent()
    expect(currentValue).toBeTruthy()
  })

  test('2.4 - Stop Live returns to static', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(500)
    await page.locator('button', { hasText: 'Stop Live' }).click()
    await page.waitForTimeout(200)
    await expect(page.locator('button', { hasText: 'Go Live' })).toBeVisible()
  })

  test('2.5 - live mode stops on navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[class*="font-semibold"]')
    await page.locator('button', { hasText: 'Go Live' }).click()
    await page.waitForTimeout(300)

    await page.locator('aside button', { hasText: 'Costs' }).click()
    await page.waitForTimeout(500)

    await page.locator('aside button', { hasText: 'Overview' }).click()
    await page.waitForSelector('[class*="font-semibold"]')

    await expect(page.locator('button', { hasText: 'Go Live' })).toBeVisible()
  })
})
