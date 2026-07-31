import { expect, test } from '@playwright/test'

test('桌面端展示核心导航和快速记录入口', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('TrackFit').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /快速记录/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /分析/ })).toBeVisible()
})

test('手机端可以打开测量表单', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  await page.goto('/')
  await page.getByRole('button', { name: /快速记录/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('同一天可以记录任意多次')).toBeVisible()
})

