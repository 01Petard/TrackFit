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
    command: 'pnpm dev --port 3100',
    env: {
      TRACKFIT_STORAGE: 'file',
      TRACKFIT_DATA_FILE: `/tmp/trackfit-e2e-${process.pid}.json`,
      NUXT_SESSION_PASSWORD: 'trackfit-e2e-session-password-at-least-32-characters',
      TRACKFIT_ADMIN_USERNAME: 'admin',
      TRACKFIT_ADMIN_PASSWORD_HASH: 'scrypt:00112233445566778899aabbccddeeff:29891e9e7ddcbe086dd4bc14bbd8238555064f27be9e5dfd677a4843424a1b600dc63598baf3138c268b5b830bc66b4b103492b38c9fa641d8a472fd2ab1c714',
      TRACKFIT_VIEWER_USERNAME: 'viewer',
      TRACKFIT_VIEWER_PASSWORD_HASH: 'scrypt:ffeeddccbbaa99887766554433221100:962d3b961b6470cbc26ffd130a4f3c2335a7c316aa347d2b1e858398f1d439ae99142cc07377266cf1a2bd84325923884969acaa8623c4b5c60354d03b995683',
      TRACKFIT_VIEWER_DISPLAY_USERNAME: 'readonly-demo',
      TRACKFIT_VIEWER_DISPLAY_PASSWORD: 'readonly-demo-pass',
    },
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'msedge' } },
  ],
})
