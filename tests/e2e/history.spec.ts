import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

let originalData: unknown

test.beforeEach(async ({ page }) => {
  const response = await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'admin-pass' } })
  expect(response.ok()).toBe(true)
  const initial = await page.request.get('/api/data')
  originalData = await initial.json()
})

test.afterEach(async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { username: 'admin', password: 'admin-pass' } })
  const current = await page.request.get('/api/data')
  const restored = await page.request.put('/api/data', { headers: { 'If-Match': current.headers().etag! }, data: originalData })
  expect(restored.ok()).toBe(true)
})

test('每日卡片聚合同类记录和重复训练项目，详情保留每条原始记录', async ({ page }, testInfo) => {
  await seedHistory(page, 1)
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  const body = data.bodyRecords[0]
  const training = data.trainingRecords[0]
  const sleep = data.sleepRecords[0]
  data.bodyRecords.push({ ...body, id: 2, measuredAt: new Date(new Date(body.measuredAt).getTime() + 3_600_000).toISOString(), values: [{ metricId: 1, value: 71.4 }] })
  data.trainingRecords.push(
    { ...training, id: 2, durationMinutes: 5 },
    { ...training, id: 3, type: 'strength', durationMinutes: 30 },
  )
  data.sleepRecords.push({ ...sleep, id: 2, fellAsleepAt: new Date(new Date(sleep.wokeUpAt).getTime() + 3_600_000).toISOString(), wokeUpAt: new Date(new Date(sleep.wokeUpAt).getTime() + 5_400_000).toISOString() })
  expect((await page.request.put('/api/data', { headers: { 'If-Match': initial.headers().etag! }, data })).ok()).toBe(true)
  await page.goto('/zh/history')
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
  const card = page.getByTestId('history-day').filter({ has: page.getByText('体重 71.4 kg', { exact: true }) })
  await expect(card.getByTestId('history-record-item')).toHaveCount(3)
  expect(await card.getByTestId('history-record-item').evaluateAll(groups => groups.map(group => group.getAttribute('data-record-kind')))).toEqual(['body', 'sleep', 'training'])
  const trainingGroup = card.locator('[data-record-kind="training"]')
  await expect(trainingGroup.getByText('训练', { exact: true })).toHaveCount(1)
  await expect(trainingGroup.getByText('慢步', { exact: true })).toHaveCount(1)
  await expect(trainingGroup).toContainText('训练时长 41 分钟')
  await expect(trainingGroup).toContainText('训练时长 30 分钟')
  const bodyGroup = card.locator('[data-record-kind="body"]')
  await expect(bodyGroup.getByText('身体', { exact: true })).toHaveCount(1)
  await expect(bodyGroup).toContainText('体重 75.5 kg')
  await expect(bodyGroup).toContainText('体重 71.4 kg')
  await expect(card.locator('[data-record-kind="sleep"]')).toContainText('睡眠时长 8 小时 0 分钟')
  await card.scrollIntoViewIfNeeded()
  await card.screenshot({ path: testInfo.outputPath('aggregated-day.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await card.click()
  const details = page.getByRole('dialog')
  await expect(details.getByTestId('history-record-item')).toHaveCount(7)
  await expect(details.getByRole('button', { name: '编辑', exact: true })).toHaveCount(7)
  await expect(details.getByRole('button', { name: '删除', exact: true })).toHaveCount(7)
})

test('记录中心四周网格、三行热力图和日期详情支持维护记录', async ({ page }, testInfo) => {
  await seedHistory(page)
  await page.goto('/zh/history')
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
  const calendar = page.getByTestId('history-calendar')
  await expect(calendar.getByTestId('history-week')).toHaveCount(4)
  await expect(calendar.getByTestId('history-day')).toHaveCount(28)
  await expect(calendar.getByTestId('history-record-item')).toHaveCount(10)
  await expect(page.getByTestId('heatmap-row')).toHaveCount(3)
  await expect(page.getByTestId('heatmap-cell')).toHaveCount(84)
  const days = calendar.getByTestId('history-week').first().getByTestId('history-day')
  const boxes = await days.evaluateAll(elements => elements.map((element) => {
    const { x, y } = element.getBoundingClientRect()
    return { x, y }
  }))
  if (testInfo.project.name === 'desktop') {
    expect(new Set(boxes.map(box => box.y)).size).toBe(1)
    expect(new Set(boxes.map(box => box.x)).size).toBe(7)
  } else {
    expect(new Set(boxes.map(box => box.x)).size).toBe(1)
    expect(new Set(boxes.map(box => box.y)).size).toBe(7)
  }
  await page.screenshot({ path: testInfo.outputPath('records.png'), fullPage: true })
  await page.screenshot({ path: testInfo.outputPath('records-viewport.png') })
  const filter = page.getByTestId('history-kind-filter')
  await expect(filter.getByRole('radio')).toHaveCount(4)
  await expect(filter.getByRole('combobox')).toHaveCount(0)
  for (const radio of await filter.getByRole('radio').all()) await expect(radio).toBeVisible()
  const radioRows = await filter.getByRole('radio').evaluateAll(radios => radios.map(radio => Math.round(radio.getBoundingClientRect().y)))
  expect(new Set(radioRows).size).toBe(1)
  await filter.locator('..').screenshot({ path: testInfo.outputPath('history-filters.png') })
  await filter.getByText('训练', { exact: true }).click()
  await calendar.getByTestId('history-day').filter({ has: page.getByTestId('history-record-item') }).click()
  const details = page.getByRole('dialog')
  await details.getByRole('button', { name: '编辑', exact: true }).click()
  const editor = page.getByRole('dialog').filter({ has: page.getByLabel('时长（分钟）', { exact: true }) })
  await expect(editor.getByLabel('时长（分钟）', { exact: true })).toHaveValue('36')
  await editor.getByLabel('时长（分钟）', { exact: true }).fill('42')
  await editor.getByRole('button', { name: '保存记录' }).click()
  await expect(editor).toBeHidden()
  await expect(details).toContainText('42 分钟')
  await details.getByRole('button', { name: '关闭记录详情' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('数据完整度按红黄绿分级，覆盖 40% 和 80% 边界', async ({ page }, testInfo) => {
  await seedHistory(page, 28, true)
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  for (const [count, percent, color] of [[0, 0, '#ef4444'], [33, 39, '#ef4444'], [34, 40, '#eab308'], [50, 60, '#eab308'], [66, 79, '#eab308'], [67, 80, '#10b981'], [84, 100, '#10b981']] as const) {
    const current = await page.request.get('/api/data')
    const response = await page.request.put('/api/data', {
      headers: { 'If-Match': current.headers().etag! },
      data: {
        ...data,
        bodyRecords: data.bodyRecords.slice(0, Math.ceil(count / 3)),
        sleepRecords: data.sleepRecords.slice(0, Math.floor((count + 1) / 3)),
        trainingRecords: data.trainingRecords.slice(0, Math.floor(count / 3)),
      },
    })
    expect(response.ok()).toBe(true)
    await page.goto('/zh/history')
    const card = page.getByTestId('record-completeness')
    const ring = card.getByRole('img', { name: `数据完整度 ${percent}%`, exact: true })
    await expect(ring).toBeVisible()
    await expect(ring.locator('circle').last()).toHaveAttribute('stroke', color)
    if ([0, 40, 80].includes(percent)) await card.screenshot({ path: testInfo.outputPath(`completeness-${percent}.png`) })
  }
})

test('旧入口跳转且访客只能查看日期详情', async ({ page }) => {
  await seedHistory(page)
  await page.goto('/zh/behavior')
  await expect(page).toHaveURL(/\/zh\/history$/)
  await page.request.post('/api/auth/login', { data: { username: 'viewer', password: 'viewer-pass' } })
  await page.goto('/zh/history')
  const calendar = page.getByTestId('history-calendar')
  await calendar.getByTestId('history-day').filter({ has: page.getByTestId('history-record-item') }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: /编辑|删除|＋/ })).toHaveCount(0)
  await page.getByRole('button', { name: '关闭记录详情' }).click()
  const emptyDate = await page.evaluate(() => {
    const date = new Date()
    date.setDate(date.getDate() - 14)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  await calendar.locator(`[data-date="${emptyDate}"]`).click()
  await expect(page.getByRole('dialog')).toContainText('暂无记录')
  await expect(page.getByRole('dialog').getByRole('button', { name: '补记', exact: true })).toHaveCount(0)
})

test('过去的空日期卡片可补记三类记录，时间默认归属所选日期', async ({ page }) => {
  await seedHistory(page)
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  expect((await page.request.put('/api/data', { headers: { 'If-Match': initial.headers().etag! }, data: { ...data, bodyRecords: [], trainingRecords: [], sleepRecords: [] } })).ok()).toBe(true)
  await page.goto('/zh/history')
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
  const target = await page.evaluate(() => {
    const date = new Date()
    date.setDate(date.getDate() - 14)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { key, body: new Date(`${key}T09:15:00`).toISOString(), training: new Date(`${key}T16:45:00`).toISOString(), wake: new Date(`${key}T06:30:00`).toISOString() }
  })
  const card = page.getByTestId('history-calendar').locator(`[data-date="${target.key}"]`)
  await expect(card).toBeEnabled()
  await card.click()
  const dialog = page.getByRole('dialog', { name: `补记 · ${target.key}`, exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('checkbox', { name: '身体', exact: true })).toBeChecked()
  await dialog.getByLabel('测量时间', { exact: true }).fill('09:15')
  await dialog.getByLabel('体重', { exact: true }).fill('70.25')
  for (const kind of ['睡眠', '健身']) await dialog.locator('label').filter({ has: page.getByRole('checkbox', { name: kind, exact: true }) }).click()
  await expect(dialog.getByLabel('训练时间', { exact: true })).toHaveValue('18:00')
  await dialog.getByLabel('训练时间', { exact: true }).fill('16:45')
  await dialog.getByLabel('时长（分钟）', { exact: true }).fill('45')
  await dialog.getByLabel('睡眠时长（小时）', { exact: true }).fill('7')
  await dialog.getByLabel('睡眠时长（分钟）', { exact: true }).fill('30')
  await dialog.getByRole('button', { name: '保存补记', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(card.getByTestId('history-record-item')).toHaveCount(3)
  const stored = await (await page.request.get('/api/data')).json()
  expect(stored.bodyRecords).toMatchObject([{ measuredAt: target.body, values: [{ metricId: 1, value: 70.25 }] }])
  expect(stored.trainingRecords).toMatchObject([{ recordedAt: target.training, durationMinutes: 45 }])
  expect(stored.sleepRecords).toMatchObject([{ wokeUpAt: target.wake }])
})

test('按健身筛选的空日期可仅补记健身，不写入其他项目', async ({ page }) => {
  await seedHistory(page)
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  data.trainingRecords = []
  expect((await page.request.put('/api/data', { headers: { 'If-Match': initial.headers().etag! }, data })).ok()).toBe(true)
  await page.goto('/zh/history')
  await page.getByTestId('history-kind-filter').getByText('训练', { exact: true }).click()
  const target = await page.evaluate(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const card = page.getByTestId('history-calendar').locator(`[data-date="${target}"]`)
  await card.click()
  const dialog = page.getByRole('dialog', { name: `补记 · ${target}`, exact: true })
  await expect(dialog.getByRole('checkbox', { name: '健身', exact: true })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: '身体', exact: true })).not.toBeChecked()
  await dialog.getByRole('button', { name: '保存补记', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(card.getByTestId('history-record-item')).toHaveCount(1)
  const stored = await (await page.request.get('/api/data')).json()
  expect(stored.bodyRecords).toHaveLength(8)
  expect(stored.trainingRecords).toHaveLength(1)
  expect(stored.sleepRecords).toHaveLength(1)
})

test('未来日期隐藏补记入口，今天和过去的详情均可补记', async ({ page }) => {
  await seedHistory(page)
  await page.goto('/zh/history')
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
  const dates = await page.evaluate(() => [1, 0, -1].map((days) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }))
  for (const date of dates.slice(0, 2)) {
    const card = page.getByTestId('history-calendar').locator(`[data-date="${date}"]`)
    await card.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: '补记', exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: '关闭记录详情' }).click()
  }
  const futureCard = page.getByTestId('history-calendar').locator(`[data-date="${dates[2]}"]`)
  await expect(futureCard).not.toContainText('补记')
  await futureCard.click()
  await expect(page.getByRole('dialog').getByRole('button', { name: '补记', exact: true })).toHaveCount(0)
  await expect(page.getByRole('dialog').getByRole('button', { name: '保存补记', exact: true })).toHaveCount(0)
})

test('分页按连续四周查询，翻页不丢记录，筛选和本周按钮重置页码', async ({ page }) => {
  await seedHistory(page, 42)
  await page.goto('/zh/history')
  const calendar = page.getByTestId('history-calendar')
  await expect(page.getByTestId('history-page')).toHaveText('1 / 2')
  const first = await calendar.getByTestId('history-record-item').evaluateAll(items => items.map(item => item.getAttribute('data-record-key')))
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(calendar.getByTestId('history-week')).toHaveCount(4)
  await expect(page.getByTestId('history-page')).toHaveText('2 / 2')
  const second = await calendar.getByTestId('history-record-item').evaluateAll(items => items.map(item => item.getAttribute('data-record-key')))
  expect(new Set([...first, ...second]).size).toBe(44)
  await page.getByTestId('history-kind-filter').getByText('训练', { exact: true }).click()
  await expect(page.getByTestId('history-page')).toHaveText('1 / 1')
  await calendar.getByTestId('history-day').filter({ has: page.getByTestId('history-record-item') }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click()
  await expect(calendar.getByTestId('history-record-item')).toHaveCount(0)
  await page.getByRole('button', { name: '关闭记录详情' }).click()
  await page.getByRole('button', { name: '本周', exact: true }).click()
  await expect(page.getByTestId('history-page')).toHaveText('1 / 1')
})

test('日期筛选包含结束当天最后一刻且可清除', async ({ page }) => {
  await seedHistory(page)
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  data.trainingRecords[0].recordedAt = await page.evaluate(() => {
    const date = new Date()
    date.setHours(23, 59, 59, 999)
    return date.toISOString()
  })
  expect((await page.request.put('/api/data', { headers: { 'If-Match': initial.headers().etag! }, data })).ok()).toBe(true)
  await page.goto('/zh/history')
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
  await page.getByText('日期筛选', { exact: true }).click()
  for (const field of ['history-start-date', 'history-end-date']) {
    await page.getByTestId(field).getByRole('button').click()
    await page.getByRole('button', { name: '今天', exact: true }).click()
    await expect(page.getByRole('button', { name: '今天', exact: true })).toBeHidden()
  }
  await expect(page.getByTestId('history-calendar').getByTestId('history-record-item')).toHaveCount(3)
  for (const field of ['history-start-date', 'history-end-date']) await page.getByTestId(field).getByRole('button', { name: '清除日期' }).click()
  await expect(page.getByTestId('history-calendar').getByTestId('history-record-item')).toHaveCount(10)
})

test('趋势页用单选切换体重睡眠和健身，移除对比和均线开关', async ({ page }, testInfo) => {
  await seedHistory(page, 100, true)
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  data.settings[0] = { ...data.settings[0], defaultDateRange: '7d', sleepGoalHours: 9, weeklyTrainingGoalMinutes: 210, weeklyTrainingGoalCount: 3 }
  expect((await page.request.put('/api/data', { headers: { 'If-Match': initial.headers().etag! }, data })).ok()).toBe(true)
  await page.goto('/zh/analysis')
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
  await expect(page.getByRole('group', { name: '指标', exact: true }).getByRole('radio')).toHaveCount(3)
  const timeRange = page.getByRole('group', { name: '时间范围', exact: true })
  await expect(timeRange.getByRole('radio')).toHaveCount(3)
  await expect(timeRange.getByRole('radio', { name: '24 小时', exact: true })).toHaveCount(0)
  await expect(timeRange.getByRole('radio', { name: '7 天', exact: true })).toHaveCount(0)
  await expect(timeRange.getByRole('combobox')).toHaveCount(0)
  await expect(timeRange.getByRole('radio', { name: '30 天', exact: true })).toBeChecked()
  const recordCount = page.locator('.analysis-stat').filter({ hasText: '记录次数' }).locator('strong > span').first()
  for (const [label, count] of [['90 天', '90'], ['全部', '100'], ['30 天', '30']]) {
    await timeRange.locator('label').filter({ has: page.getByRole('radio', { name: label, exact: true }) }).click()
    await expect(timeRange.getByRole('radio', { name: label, exact: true })).toBeChecked()
    await expect(recordCount).toHaveText(count!)
  }
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByText('对比指标', { exact: true })).toHaveCount(0)
  await expect(page.getByText('均线显示', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: '体重', exact: true })).toBeChecked()
  const trend = page.getByTestId('indicator-trend')
  const headingBox = (await page.getByTestId('indicator-heading').boundingBox())!
  const trendBox = (await trend.boundingBox())!
  expect(headingBox.y - trendBox.y).toBeLessThanOrEqual(25)
  await page.getByText('睡眠', { exact: true }).filter({ has: page.getByRole('radio') }).click()
  await expect(page.getByTestId('indicator-chart-title')).toHaveText('睡眠时长 (h)')
  await expect(page.getByRole('heading', { name: '未来体重趋势预测' })).toHaveCount(0)
  await expect(trend.getByTestId('metric-chart')).toHaveAttribute('aria-busy', 'false')
  const goal = () => trend.locator('.echarts').evaluate((element) => {
    const chart = (element as HTMLElement & { __vueParentComponent: { exposed: { getOption: () => { series: { type: string, itemStyle: { color: string }, markLine: { data: { yAxis: number }[], label: { formatter: string } } }[], yAxis: { min: number, max: number }[] } } } }).__vueParentComponent.exposed
    const option = chart.getOption()
    return { value: option.series[0]!.markLine.data[0]?.yAxis, label: option.series[0]!.markLine.label.formatter, min: option.yAxis[0]!.min, max: option.yAxis[0]!.max, type: option.series[0]!.type, color: option.series[0]!.itemStyle.color, seriesTypes: option.series.map(series => series.type) }
  })
  expect(await goal()).toMatchObject({ value: 9, label: '目标 9 h', type: 'bar', color: '#7f22fe', min: 0, seriesTypes: ['bar', 'line', 'line', 'line'] })
  expect((await goal()).max).toBeGreaterThan(9)
  await trend.screenshot({ path: testInfo.outputPath('analysis-sleep.png') })
  await page.getByText('健身', { exact: true }).filter({ has: page.getByRole('radio') }).click()
  await expect(page.getByTestId('indicator-chart-title')).toHaveText('训练时长 (min)')
  const chart = page.getByTestId('indicator-trend').locator('.echarts')
  await expect(chart).toBeVisible()
  await expect(page.getByTestId('indicator-trend').getByTestId('metric-chart')).toHaveAttribute('aria-busy', 'false')
  expect(await goal()).toMatchObject({ value: 70, label: '目标 70 min', type: 'bar', color: '#e79d81', min: 0 })
  expect((await goal()).max).toBeGreaterThan(70)

  await expect.poll(async () => chart.evaluate(element => element.querySelector('canvas')?.clientWidth ?? 0)).toBeGreaterThan(await chart.evaluate(element => element.parentElement!.clientWidth * 0.9))

  await page.screenshot({ path: testInfo.outputPath('analysis.png'), fullPage: true })
  await trend.screenshot({ path: testInfo.outputPath('analysis-training.png') })
  await page.getByText('体重', { exact: true }).filter({ has: page.getByRole('radio') }).click()
  await expect(trend.getByTestId('metric-chart')).toHaveAttribute('aria-busy', 'false')
  expect(await goal()).toMatchObject({ type: 'line', color: '#00cb57' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('首页四张指标卡统一显示变化，单条记录提示暂无对比，导航使用简短名称', async ({ page }, testInfo) => {
  await seedHistory(page, 2)
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  data.settings[0].heightCm = 175
  const ids = Object.fromEntries(data.metrics.map((metric: { id: number, code: string }) => [metric.code, metric.id]))
  data.bodyRecords[0].values = [{ metricId: ids.weight, value: 70 }, { metricId: ids.body_fat, value: 26 }, { metricId: ids.waist, value: 80 }]
  data.bodyRecords[1].values = [{ metricId: ids.weight, value: 71 }, { metricId: ids.body_fat, value: 25 }, { metricId: ids.waist, value: 80 }]
  expect((await page.request.put('/api/data', { headers: { 'If-Match': initial.headers().etag! }, data })).ok()).toBe(true)
  await page.goto('/zh/')
  await page.addStyleTag({ content: 'nuxt-devtools-frame { display: none !important; }' })
  const cards = page.getByTestId('overview-card')
  await expect(cards).toHaveCount(4)
  for (const [code, change] of [['weight', '↗ 1 kg'], ['bmi', '↗ 0.32'], ['waist', '→ 0 cm'], ['body_fat', '↘ 1 %']]) {
    await expect(cards.and(page.locator(`[data-metric-code="${code}"]`)).getByTestId('overview-change')).toHaveText(change!)
  }
  const navigation = page.locator('nav:visible')
  await expect(navigation.getByRole('link', { name: '趋势', exact: true })).toHaveAttribute('href', '/zh/analysis')
  await expect(navigation.getByRole('link', { name: '回顾', exact: true })).toHaveAttribute('href', '/zh/history')
  await cards.first().locator('..').screenshot({ path: testInfo.outputPath('overview-changes.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const current = await page.request.get('/api/data')
  data.bodyRecords = data.bodyRecords.slice(1)
  expect((await page.request.put('/api/data', { headers: { 'If-Match': current.headers().etag! }, data })).ok()).toBe(true)
  await page.reload()
  await expect(page.getByTestId('overview-change')).toHaveCount(4)
  for (const badge of await page.getByTestId('overview-change').all()) await expect(badge).toHaveText('— 暂无对比')
})

test('每周健身次数默认五次且可以保存配置', async ({ page }) => {
  await page.goto('/zh/settings')
  await expect(page.getByLabel('每周健身次数', { exact: true })).toHaveValue('5')
  await page.getByLabel('身高（cm）', { exact: true }).fill('175')
  await page.getByLabel('每周健身次数', { exact: true }).fill('6')
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await expect(page.getByText('设置已保存', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('每周健身次数', { exact: true })).toHaveValue('6')
})

async function seedHistory(page: Page, days = 8, behaviorHistory = false): Promise<void> {
  const initial = await page.request.get('/api/data')
  const data = await initial.json()
  const dates = await page.evaluate((count) => {
    const today = new Date()
    today.setHours(8, 0, 0, 0)
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (count - 1 - index))
      return date.toISOString()
    })
  }, days)
  const wake = new Date(dates.at(-1)!)
  wake.setHours(7)
  const response = await page.request.put('/api/data', {
    headers: { 'If-Match': initial.headers().etag! },
    data: {
      ...data,
      bodyRecords: dates.map((measuredAt, index) => ({ id: index + 1, measuredAt, note: '晨起空腹测量', values: [{ metricId: 1, value: Number((75.5 - index * 0.01).toFixed(2)) }, { metricId: 2, value: 24.8 }] })),
      trainingRecords: behaviorHistory ? dates.map((date, index) => ({ id: index + 1, recordedAt: date, type: 'strength', durationMinutes: 30 + index % 7 * 5, note: null })) : [{ id: 1, recordedAt: dates.at(-1), type: 'cardio', durationMinutes: 36, note: null }],
      sleepRecords: behaviorHistory ? dates.map((date, index) => ({ id: index + 1, fellAsleepAt: new Date(new Date(date).getTime() - (420 + index % 5 * 15) * 60_000).toISOString(), wokeUpAt: date, quality: 80, note: null })) : [{ id: 1, fellAsleepAt: new Date(wake.getTime() - 450 * 60_000).toISOString(), wokeUpAt: wake.toISOString(), quality: 80, note: null }],
    },
  })
  expect(response.ok()).toBe(true)
}
