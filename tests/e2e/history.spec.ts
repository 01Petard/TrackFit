import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

let originalData: unknown

test.beforeEach(async ({ page }) => {
  const response = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin-pass' },
  })
  expect(response.ok()).toBe(true)
  const initial = await page.request.get('/api/data')
  expect(initial.ok()).toBe(true)
  originalData = await initial.json()
})

test.afterEach(async ({ page }) => {
  const current = await page.request.get('/api/data')
  if (!current.ok()) return
  const restored = await page.request.put('/api/data', {
    headers: { 'If-Match': current.headers().etag! },
    data: originalData,
  })
  expect(restored.ok()).toBe(true)
})

test('首页最近记录与趋势卡片等高并隐藏溢出内容', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await seedHistory(page)
  await page.goto('/zh/')

  const trendCard = page.getByTestId('weight-trend-card')
  const recentCard = page.getByTestId('recent-records-card')
  const [trendBox, recentBox] = await Promise.all([trendCard.boundingBox(), recentCard.boundingBox()])
  expect(trendBox).not.toBeNull()
  expect(recentBox).not.toBeNull()
  expect(Math.abs(trendBox!.height - recentBox!.height)).toBeLessThanOrEqual(1)
  await expect(page.getByTestId('recent-records-viewport')).toHaveCSS('overflow-y', 'hidden')
  await expect(page.getByRole('link', { name: '查看历史记录' })).toHaveAttribute('href', '/zh/history')
})

test('历史记录页统一查看和筛选三类记录且没有写操作', async ({ page }) => {
  await seedHistory(page)
  await page.goto('/zh/history')

  await expect(page.getByRole('heading', { name: '历史记录' })).toBeVisible()
  await expect(page.getByTestId('history-record-item')).toHaveCount(10)
  await page.getByTestId('history-kind-filter').selectOption('training')
  await expect(page.getByTestId('history-record-item')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /编辑|删除|新增/ })).toHaveCount(0)
})

async function seedHistory(page: Page): Promise<void> {
  const initial = await page.request.get('/api/data')
  expect(initial.ok()).toBe(true)
  const data = await initial.json()
  const bodyRecords = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    measuredAt: new Date(Date.UTC(2026, 7, index + 3, 7, 30)).toISOString(),
    note: index === 7 ? '晨起空腹测量' : null,
    values: [
      { metricId: 1, value: 75.5 - index * 0.1 },
      { metricId: 2, value: 24.8 - index * 0.1 },
      { metricId: 3, value: 88 - index * 0.1 },
    ],
  }))
  const response = await page.request.put('/api/data', {
    headers: { 'If-Match': initial.headers().etag! },
    data: {
      ...data,
      bodyRecords,
      trainingRecords: [{ id: 1, recordedAt: '2026-08-10T10:50:18.000Z', type: 'cardio', durationMinutes: 36, note: null }],
      sleepRecords: [{ id: 1, fellAsleepAt: '2026-08-10T19:04:00.000Z', wokeUpAt: '2026-08-10T23:22:00.000Z', quality: 56, note: null }],
    },
  })
  expect(response.ok()).toBe(true)
}
