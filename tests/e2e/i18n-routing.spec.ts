import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

async function loginAsAdmin(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin-pass' },
  })
  expect(response.ok()).toBe(true)
}

test('中文浏览器首次访问进入中文登录页', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-TW' })
  const page = await context.newPage()

  await page.goto('/')

  await expect(page).toHaveURL(/\/zh\/login$/)
  await context.close()
})

test('非中文浏览器首次访问进入英文登录页', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ja-JP' })
  const page = await context.newPage()

  await page.goto('/')

  await expect(page).toHaveURL(/\/en\/login$/)
  await context.close()
})

test('语言按钮位于退出与 GitHub 之间并保留当前页面', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/zh/settings?source=test')

  const actions = page.locator('header .header-actions')
  const switchButton = actions.getByRole('button', { name: '切换到英文' })
  await expect(switchButton).toBeVisible()
  await expect.poll(async () => actions.locator(':scope > *').evaluateAll(elements => elements.slice(-3).map(element => element.getAttribute('aria-label') ?? element.textContent?.trim()))).toEqual([
    '退出',
    '切换到英文',
    'GitHub 仓库：01Petard/TrackFit',
  ])

  await switchButton.click()

  await expect(page).toHaveURL(/\/en\/settings\?source=test$/)
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/en\/settings\?source=test$/)
})

test('英文首页和测量弹窗显示英文系统文案', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/en/')

  await expect(page.getByRole('heading', { name: 'Body overview' })).toBeVisible()
  const navigation = page.locator('nav:visible')
  await expect(navigation.getByRole('link', { name: 'Trends', exact: true })).toHaveAttribute('href', '/en/analysis')
  await expect(navigation.getByRole('link', { name: 'Review', exact: true })).toHaveAttribute('href', '/en/history')
  await page.getByRole('button', { name: 'Quick record' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Record body data' })).toBeVisible()
  await expect(dialog.getByText('All enabled metrics can be filled in directly')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save record' })).toBeVisible()
})

test('英文页面显示本地化登录错误', async ({ page }) => {
  await page.goto('/en/login')
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Incorrect username or password')
})

test('英文分析、行为和历史页使用英文标题', async ({ page }, testInfo) => {
  await loginAsAdmin(page)
  for (const [path, heading] of [
    ['/en/analysis', 'Trend Analysis'],
    ['/en/behavior', 'Records'],
    ['/en/history', 'Records'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    if (path === '/en/analysis') {
      const timeRange = page.getByRole('group', { name: 'Time range', exact: true })
      await expect(timeRange.getByRole('radio')).toHaveCount(3)
      await expect(timeRange.getByRole('radio', { name: '30 days', exact: true })).toBeChecked()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.getByTestId('indicator-heading').locator('..').screenshot({ path: testInfo.outputPath('analysis-controls-en.png') })
    }
  }
})
