import { test, expect } from '@playwright/test'

test.describe('E2E-5: Team Drill-Down Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('aside button', { hasText: 'Teams' }).click()
    await page.waitForSelector('text=All Teams', { timeout: 30_000 })
  })

  test('5.1 - teams page shows virtualized grid', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'All Teams' })).toBeVisible()
    const rows = page.locator('[class*="cursor-pointer"][class*="hover"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('5.2 - team tabs visible and clickable', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'All Teams' })).toBeVisible()
    const tabs = page.locator('button').filter({ hasText: /^[A-Z]/ })
    const count = await tabs.count()
    expect(count).toBeGreaterThan(1)
  })

  test('5.3 - click team tab navigates to detail', async ({ page }) => {
    // Click the first team tab (not "All Teams", not sidebar) inside the sticky tabs area
    const tabsArea = page.locator('.sticky')
    const teamTab = tabsArea.locator('button').filter({ hasNotText: /All Teams|and \d+ more/ }).first()
    await teamTab.click({ force: true })
    await expect(page).toHaveURL(/\/teams\//, { timeout: 20_000 })
  })

  test('5.4 - team detail shows KPIs', async ({ page }) => {
    await page.goto('/teams/backend')
    await page.waitForSelector('[class*="uppercase"][class*="tracking"]', { timeout: 20_000 })

    const labels = page.locator('[class*="uppercase"][class*="tracking"]')
    const count = await labels.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('5.5 - team detail shows members table', async ({ page }) => {
    await page.goto('/teams/backend')
    await page.waitForSelector('text=Team Members', { timeout: 20_000 })

    const emailCells = page.locator('[class*="text-accent-foreground"]')
    const count = await emailCells.count()
    expect(count).toBeGreaterThan(0)

    const texts = await emailCells.allTextContents()
    const hasEmail = texts.some(t => t.includes('@'))
    expect(hasEmail).toBe(true)
  })

  test('5.6 - All Teams tab returns to grid', async ({ page }) => {
    await page.goto('/teams/backend')
    await page.waitForSelector('text=All Teams', { timeout: 20_000 })

    await page.locator('button', { hasText: 'All Teams' }).click()
    await page.waitForURL(/\/teams$/, { timeout: 20_000 })
    await expect(page.locator('h1', { hasText: 'All Teams' })).toBeVisible()
  })

  test('5.7 - team tabs show on detail page', async ({ page }) => {
    await page.goto('/teams/backend')
    await page.waitForSelector('text=All Teams', { timeout: 20_000 })
    await expect(page.locator('button', { hasText: 'All Teams' })).toBeVisible()
  })

  test('5.8 - budget inline shows on detail page', async ({ page }) => {
    await page.goto('/teams/backend')
    await page.waitForSelector('h1', { timeout: 20_000 })
    await expect(page.locator('main').getByText(/\$[\d,.]+ \/ \$[\d,.]+/).last()).toBeVisible()
  })
})
