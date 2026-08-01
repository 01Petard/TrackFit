import { expect, test } from '@playwright/test'

test('桌面端展示核心导航和快速记录入口', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a:visible').filter({ hasText: 'TrackFit' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /快速记录/ })).toBeVisible()
  await expect(page.locator('a[href="/analysis"]:visible').first()).toBeVisible()
})

test('手机端可以打开测量表单', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  await page.goto('/')
  await page.getByRole('button', { name: /快速记录/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByText('同一天可以记录任意多次')).toBeVisible()
  await expect(page.getByText('所有已启用指标均可直接填写')).toBeVisible()
  await expect(page.getByText('腰围', { exact: true })).toBeVisible()
  await expect(page.locator('details')).toHaveCount(0)
  await dialog.getByRole('button', { name: /年.*月.*日/ }).click()
  await page.getByLabel('具体时间').fill('08:30:15')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /08:30:15/ })).toBeVisible()
})

test('记录页使用统一日期选择器', async ({ page }) => {
  await page.goto('/records')
  await page.getByRole('button', { name: '不限开始日期' }).click()
  await expect(page.getByRole('button', { name: '今天', exact: true })).toBeVisible()
})

test('指标管理使用明确的新增和编辑状态', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.goto('/metrics')
  await page.getByRole('button', { name: '新增指标' }).click()
  await page.getByLabel('指标名称').fill('睡眠质量')
  await page.getByLabel('指标编码').fill('sleep_quality')
  await page.getByLabel('单位').fill('分')
  await page.getByRole('button', { name: '保存指标' }).click()

  const row = page.locator('article').filter({ hasText: 'sleep_quality' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '编辑' }).click()
  await expect(row.getByLabel('名称')).toHaveValue('睡眠质量')
  await expect(row.getByRole('button', { name: '保存' })).toBeDisabled()
})

test('数据接口使用 ETag 阻止过期覆盖', async ({ request }) => {
  const initial = await request.get('/api/data')
  expect(initial.ok()).toBe(true)
  const etag = initial.headers().etag
  expect(etag).toBeTruthy()
  const data = await initial.json()

  const saved = await request.put('/api/data', { headers: { 'If-Match': etag }, data })
  expect(saved.ok()).toBe(true)

  const conflict = await request.put('/api/data', { headers: { 'If-Match': etag }, data })
  expect(conflict.status()).toBe(409)
})
