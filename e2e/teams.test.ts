import { test, expect } from '@playwright/test'

// --- E2E-5: Team Drill-Down Journey ---

test.describe('E2E-5: Team Drill-Down Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('aside button', { hasText: 'Teams' }).click()
    await page.waitForSelector('table', { timeout: 10_000 })
  })

  test('5.1 - teams page shows comparison table', async ({ page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(6)
  })

  test('5.2 - click team tab drills down', async ({ page }) => {
    // Our UI uses tabs for team selection
    const backendTab = page.locator('button', { hasText: 'Backend' }).first()
    await backendTab.click()
    await page.waitForTimeout(1000)

    const labels = page.locator('[class*="uppercase"][class*="tracking"]')
    const count = await labels.count()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('5.3 - team detail shows KPIs', async ({ page }) => {
    await page.locator('button', { hasText: 'Backend' }).first().click()
    await page.waitForTimeout(1000)

    // KPI labels should include cost-related text
    await expect(page.locator('text=COST').first()).toBeVisible()
  })

  test('5.4 - user table shows team members', async ({ page }) => {
    await page.locator('button', { hasText: 'Backend' }).first().click()
    await page.waitForTimeout(2000)

    // Wait for user table with email addresses
    await page.waitForSelector('text=Team Members', { timeout: 10_000 })
    const emailCells = page.locator('[class*="text-accent-foreground"]')
    const count = await emailCells.count()
    expect(count).toBeGreaterThan(0)

    const texts = await emailCells.allTextContents()
    const hasEmail = texts.some(t => t.includes('@'))
    expect(hasEmail).toBe(true)
  })

  test('5.5 - back to all teams works', async ({ page }) => {
    await page.locator('button', { hasText: 'Backend' }).first().click()
    await page.waitForTimeout(1000)

    await page.locator('button', { hasText: 'All Teams' }).click()
    await page.waitForSelector('table tbody tr')

    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(6)
  })
})
