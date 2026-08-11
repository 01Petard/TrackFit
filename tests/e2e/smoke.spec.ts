import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  const response = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin-pass' },
  })
  expect(response.ok()).toBe(true)
})

test('未登录用户会跳转登录页', async ({ page }) => {
  await page.context().clearCookies()
  expect((await page.request.get('/api/data')).status()).toBe(401)
  await page.goto('/zh/settings')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  await expect(page.getByText('访客账号：readonly-demo readonly-demo-pass')).toBeVisible()
})

test('只读访客不显示写入和导出入口', async ({ page }) => {
  await page.context().clearCookies()
  const login = await page.request.post('/api/auth/login', {
    data: { username: 'viewer', password: 'viewer-pass' },
  })
  expect(login.ok()).toBe(true)
  await page.goto('/zh/')
  await expect(page.getByText('只读访客').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /快速记录/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '＋ 睡眠' })).toHaveCount(0)
  await page.goto('/zh/settings')
  await expect(page.getByText('当前账号为只读访客')).toBeVisible()
  await expect(page.getByRole('button', { name: /下载 JSON|导出 CSV|恢复数据/ })).toHaveCount(0)

  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  const denied = await page.request.put('/api/data', {
    headers: { 'If-Match': initial.headers().etag },
    data,
  })
  expect(denied.status()).toBe(403)
})

test('退出后需要重新登录', async ({ page }) => {
  await page.goto('/zh/')
  await page.getByRole('button', { name: '退出' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('桌面端使用顶部导航并展示概览入口', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.goto('/zh/')
  await expect(page.locator('a:visible').filter({ hasText: 'TrackFit' }).first()).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link')).toHaveCount(2)
  const repositoryLink = page.getByRole('link', { name: 'GitHub 仓库：01Petard/TrackFit' })
  await expect(repositoryLink).toBeVisible()
  await expect(repositoryLink).toHaveAttribute('href', 'https://github.com/01Petard/TrackFit')
  await expect(repositoryLink).toHaveAttribute('target', '_blank')
  await expect(page.getByRole('button', { name: /快速记录/ })).toBeVisible()
  await expect(page.locator('a[href="/zh/analysis"]:visible').first()).toBeVisible()
  const mainNavigation = page.getByRole('navigation', { name: '主导航' })
  const homeNavigation = mainNavigation.getByRole('link', { name: '主页' })
  const settingsNavigation = mainNavigation.getByRole('link', { name: '设置' })
  await expect(homeNavigation).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(homeNavigation).toHaveCSS('color', await settingsNavigation.evaluate(element => getComputedStyle(element).color))
  const recordsButton = page.getByRole('button', { name: '测量记录', exact: true })
  await expect(recordsButton).toBeVisible()
  await expect(page.getByRole('button', { name: '指标管理', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /进入行为记录/ })).toBeVisible()
  await expect(page.locator('nav a:visible')).toHaveCount(2)
  await expect(page.locator('nav a[href="/records"]:visible')).toHaveCount(0)
  await expect(page.locator('nav a[href="/analysis"]:visible')).toHaveCount(0)
  await expect(page.locator('nav a[href="/metrics"]:visible')).toHaveCount(0)
  await expect(page.locator('nav a[href="/behavior"]:visible')).toHaveCount(0)
  await recordsButton.click()
  await expect(page.getByRole('dialog', { name: '测量记录' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: '关闭测量记录' }).click()
  await page.getByRole('button', { name: '指标管理', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '指标管理' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: '关闭指标管理' }).click()

  const navigationHeader = page.locator('header.sticky')
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }))
  await expect(navigationHeader).toHaveClass(/-translate-y-full/)
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }))
  await expect(navigationHeader).toHaveClass(/translate-y-0/)
})

test('手机端可以打开测量表单', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  await page.goto('/zh/')
  await page.getByRole('button', { name: /快速记录/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByText('同一天可以记录任意多次')).toBeVisible()
  await expect(page.getByText('所有已启用指标均可直接填写')).toBeVisible()
  await expect(page.getByText('腰围', { exact: true })).toBeVisible()
  await expect(page.locator('details')).toHaveCount(0)
  await dialog.getByRole('button', { name: /\d{4}\/\d{1,2}\/\d{1,2}/ }).click()
  await page.getByLabel('具体时间').fill('08:30:15')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /8:30:15/ })).toBeVisible()
})

test('首页可以快捷记录睡眠和训练', async ({ page }) => {
  await page.goto('/zh/')

  await page.getByRole('button', { name: '＋ 睡眠' }).click()
  await expect(page.getByRole('heading', { name: '新增睡眠记录' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '×' }).click()

  await page.getByRole('button', { name: '＋ 训练' }).click()
  await expect(page.getByRole('heading', { name: '新增训练记录' })).toBeVisible()
})

test('记录页使用统一日期选择器', async ({ page }) => {
  await page.goto('/zh/records')
  await page.getByRole('button', { name: '不限开始日期' }).click()
  await expect(page.getByRole('button', { name: '今天', exact: true })).toBeVisible()
})

test('指标管理使用明确的新增和编辑状态', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.goto('/zh/metrics')
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

test('桌面端和手机端均可维护训练与睡眠记录', async ({ page }, testInfo) => {
  await page.goto('/zh/behavior')
  const duration = testInfo.project.name === 'mobile' ? 47 : 46
  await page.getByRole('button', { name: '＋ 训练' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '力量', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '慢步', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '拉伸', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '复制上一条' })).toHaveCount(0)
  await expect(dialog.getByText('训练时间', { exact: true })).toHaveCount(0)
  await expect(dialog.getByLabel('主观强度（1–10）')).toHaveCount(0)
  await dialog.getByLabel('时长（分钟）').fill(String(duration))
  await dialog.getByRole('button', { name: '保存记录' }).click()
  await expect(dialog).toBeHidden()

  const record = page.locator('tr:visible, article:visible').filter({ hasText: `${duration} 分钟` }).filter({ has: page.getByRole('button', { name: '编辑' }) }).first()
  await expect(record).toBeVisible()
  await record.getByRole('button', { name: '编辑' }).click()
  await dialog.getByLabel('时长（分钟）').fill(String(duration + 1))
  await dialog.getByRole('button', { name: '保存记录' }).click()

  const updated = page.locator('tr:visible, article:visible').filter({ hasText: `${duration + 1} 分钟` }).filter({ has: page.getByRole('button', { name: '删除' }) }).first()
  await expect(updated).toBeVisible()
  page.once('dialog', prompt => prompt.accept())
  await updated.getByRole('button', { name: '删除' }).click()
  await expect(updated).toHaveCount(0)

  await page.getByRole('button', { name: '＋ 睡眠' }).click()
  await dialog.getByLabel('睡眠时间（小时）').fill('7.5')
  await dialog.getByLabel('睡眠分数').fill('80')
  await dialog.getByRole('button', { name: '保存记录' }).click()
  const sleepRecord = page.locator('tr:visible, article:visible').filter({ hasText: '分数 80' }).filter({ has: page.getByRole('button', { name: '编辑' }) }).first()
  await expect(sleepRecord).toBeVisible()
  await sleepRecord.getByRole('button', { name: '编辑' }).click()
  await dialog.getByLabel('睡眠分数').fill('90')
  await dialog.getByRole('button', { name: '保存记录' }).click()
  const updatedSleep = page.locator('tr:visible, article:visible').filter({ hasText: '分数 90' }).filter({ has: page.getByRole('button', { name: '删除' }) }).first()
  await expect(updatedSleep).toBeVisible()
  page.once('dialog', prompt => prompt.accept())
  await updatedSleep.getByRole('button', { name: '删除' }).click()
  await expect(updatedSleep).toHaveCount(0)
})

test('数据接口使用 ETag 阻止过期覆盖', async ({ request }) => {
  const login = await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin-pass' } })
  expect(login.ok()).toBe(true)
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
