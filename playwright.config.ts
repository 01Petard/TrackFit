import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `TRACKFIT_DATA_FILE=/tmp/trackfit-e2e-${process.pid}.json pnpm dev --port 3100`,
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'msedge' } },
  ],
})
