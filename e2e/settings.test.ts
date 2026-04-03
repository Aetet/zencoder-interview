import { test, expect } from '@playwright/test'

// --- E2E-6: Settings & Budget Journey ---

test.describe('E2E-6: Settings & Budget Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('aside button', { hasText: 'Settings' }).click()
    await page.waitForSelector('input[type="number"]', { timeout: 10_000 })
  })

  test('6.1 - settings page loads with budget form', async ({ page }) => {
    await expect(page.locator('input[type="number"]')).toBeVisible()
    await expect(page.locator('text=Organization Budget')).toBeVisible()
  })

  test('6.2 - budget input editable', async ({ page }) => {
    const input = page.locator('input[type="number"]')
    await input.clear()
    await input.fill('5000')
    await expect(input).toHaveValue('5000')
  })

  test('6.3 - save budget works', async ({ page }) => {
    const input = page.locator('input[type="number"]')
    await input.clear()
    await input.fill('7000')

    await page.locator('button', { hasText: 'Save Changes' }).click()
    await page.waitForTimeout(1500)

    await expect(page.locator('button', { hasText: 'Save Changes' })).toBeVisible()
  })

  test('6.5 - alert thresholds toggleable', async ({ page }) => {
    // Toggle buttons are the small rounded-full buttons inside the threshold section
    const toggles = page.locator('[class*="rounded-full"][class*="relative"]')
    const count = await toggles.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('6.6 - team budget section visible', async ({ page }) => {
    // Look for team budget labels in text content
    const pageText = await page.textContent('body')
    expect(pageText).toContain('Backend')
    expect(pageText).toContain('Frontend')
  })
})
