import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 1,
  workers: 3,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'TEAM_COUNT=100 pnpm --filter backend dev',
      port: 3001,
      reuseExistingServer: true,
      timeout: 10_000,
    },
    {
      command: 'pnpm --filter frontend dev',
      port: 5173,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
})
