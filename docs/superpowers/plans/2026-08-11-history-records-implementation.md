# 最近记录与历史记录页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 压缩首页最近记录并限制其桌面高度，同时新增可筛选身体、训练、睡眠数据的只读历史记录页。

**Architecture:** 新增纯函数 `listHistoryRecords` 将 v6 数据转换为统一展示模型，并由 `useTrackFitData` 暴露查询入口。新增 `UnifiedRecordList` 组件复用同一展示规则：首页启用紧凑模式并在固定高度内裁切，`/history` 页面使用完整模式和筛选条件。

**Tech Stack:** Nuxt 4、Vue 3、TypeScript、Tailwind CSS、Day.js、Vitest、Playwright

## Global Constraints

- 历史记录页仅查看，不提供新增、编辑或删除能力
- 首页最近记录区域不使用内部滚动条，桌面端超出内容直接隐藏
- 首页单条记录采用紧凑布局，备注最多显示一行
- `/history` 支持全部、身体、训练、睡眠类型筛选及开始/结束日期筛选
- 不修改 v6 JSON 持久化结构
- 保留当前 `app/pages/index.vue` 中尚未提交的统一最近记录修改，并在此基础上重构

---

### Task 1: 统一历史记录查询模型

**Files:**
- Create: `shared/utils/history.ts`
- Modify: `app/composables/useTrackFitData.ts`
- Test: `tests/unit/history.test.ts`

**Interfaces:**
- Consumes: `TrackFitData`、`listMeasurements`、`listBehaviorTimeline`
- Produces: `HistoryRecordKind`、`HistoryRecordQuery`、`HistoryRecordItem`、`listHistoryRecords(data, query)`、`store.listHistoryRecords(query)`

- [ ] **Step 1: 写入三类记录合并和排序的失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import { listHistoryRecords } from '../../shared/utils/history'

it('合并身体训练睡眠记录并按发生时间倒序排列', () => {
  const data = backupSchema.parse(historyFixture())
  expect(listHistoryRecords(data).map(item => item.key)).toEqual([
    'sleep-1',
    'training-1',
    'body-1',
  ])
  expect(listHistoryRecords(data)[2]).toMatchObject({
    kind: 'body',
    title: '身体测量',
    details: ['体重 70 kg', 'BMI 22.86'],
  })
})
```

- [ ] **Step 2: 运行测试确认因模块不存在而失败**

Run: `pnpm vitest run tests/unit/history.test.ts`

Expected: FAIL，提示无法解析 `../../shared/utils/history`

- [ ] **Step 3: 实现统一展示模型和排序**

```ts
export type HistoryRecordKind = 'body' | 'training' | 'sleep'

export interface HistoryRecordQuery {
  kind?: HistoryRecordKind
  start?: string
  end?: string
}

export interface HistoryRecordItem {
  key: string
  id: number
  kind: HistoryRecordKind
  occurredAt: string
  title: string
  details: string[]
  description: string
}

export function listHistoryRecords(data: TrackFitData, query: HistoryRecordQuery = {}): HistoryRecordItem[] {
  const bodyRecords = listMeasurements(data, { page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items
    .map(toBodyHistoryRecord)
  const behaviorRecords = listBehaviorTimeline(data).map(toBehaviorHistoryRecord)
  return [...bodyRecords, ...behaviorRecords]
    .filter(item => query.kind == null || item.kind === query.kind)
    .filter(item => query.start == null || new Date(item.occurredAt).getTime() >= new Date(query.start).getTime())
    .filter(item => query.end == null || new Date(item.occurredAt).getTime() <= new Date(query.end).getTime())
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || b.id - a.id)
}
```

身体记录的 `details` 包含全部原始指标，并按可用性追加 BMI、腰臀比；训练包含训练时长；睡眠包含睡眠时长与睡眠分数。`description` 分别使用备注或明确的中文说明。

- [ ] **Step 4: 增加类型和日期筛选测试**

```ts
it('按记录类型和日期范围筛选', () => {
  const data = backupSchema.parse(historyFixture())
  expect(listHistoryRecords(data, { kind: 'training' }).map(item => item.kind)).toEqual(['training'])
  expect(listHistoryRecords(data, {
    start: '2026-08-02T00:00:00.000Z',
    end: '2026-08-02T23:59:59.999Z',
  }).map(item => item.key)).toEqual(['training-1'])
})
```

- [ ] **Step 5: 从数据 Store 暴露查询接口并验证测试通过**

```ts
listHistoryRecords: (query?: HistoryRecordQuery) => data.value ? listHistoryRecordsFromData(data.value, query) : [],
```

Run: `pnpm vitest run tests/unit/history.test.ts`

Expected: PASS

- [ ] **Step 6: 提交统一查询模型**

```bash
git add shared/utils/history.ts app/composables/useTrackFitData.ts tests/unit/history.test.ts
git commit -m "feat: 增加统一历史记录查询"
```

### Task 2: 抽取复用记录列表并限制首页高度

**Files:**
- Create: `app/components/UnifiedRecordList.vue`
- Modify: `app/pages/index.vue`
- Test: `tests/e2e/history.spec.ts`

**Interfaces:**
- Consumes: `HistoryRecordItem[]`
- Produces: `<UnifiedRecordList :items="items" compact />`，测试标识 `history-record-list` 和 `history-record-item`

- [ ] **Step 1: 写入首页等高、隐藏溢出和历史入口的失败测试**

```ts
test('首页最近记录与趋势卡片等高并隐藏溢出内容', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await seedHistory(page)
  await page.goto('/')

  const trendCard = page.getByTestId('weight-trend-card')
  const recentCard = page.getByTestId('recent-records-card')
  const [trendBox, recentBox] = await Promise.all([trendCard.boundingBox(), recentCard.boundingBox()])
  expect(Math.abs(trendBox!.height - recentBox!.height)).toBeLessThanOrEqual(1)
  await expect(page.getByTestId('recent-records-viewport')).toHaveCSS('overflow-y', 'hidden')
  await expect(page.getByRole('link', { name: '查看历史记录' })).toHaveAttribute('href', '/history')
})
```

`seedHistory(page)` 通过当前 `/api/data` ETag 写入 8 条带三个身体指标的身体记录、1 条训练记录和 1 条睡眠记录，确保首页内容真实超过可用高度，并让历史页固定得到 10 条记录。

- [ ] **Step 2: 运行用例确认因测试标识和入口不存在而失败**

Run: `pnpm exec playwright test tests/e2e/history.spec.ts --project=desktop --grep "首页最近记录"`

Expected: FAIL，找不到 `weight-trend-card` 或 `recent-records-card`

- [ ] **Step 3: 实现复用记录列表组件**

```vue
<script setup lang="ts">
import type { HistoryRecordItem } from '../../shared/utils/history'
import dayjs from 'dayjs'

defineProps<{ items: HistoryRecordItem[], compact?: boolean }>()

const kindLabels = { body: '身体', training: '训练', sleep: '睡眠' } as const
const kindClasses = {
  body: 'bg-primary/10 text-primary',
  training: 'bg-warning/10 text-warning',
  sleep: 'bg-indigo-500/10 text-indigo-500',
} as const
</script>

<template>
  <div data-testid="history-record-list" class="divide-y divide-default">
    <article
      v-for="item in items"
      :key="item.key"
      data-testid="history-record-item"
      :class="compact ? 'py-2.5' : 'py-4'"
    >
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong class="text-sm">{{ item.title }}</strong>
        <span class="rounded-md px-2 py-0.5 text-[11px] font-medium" :class="kindClasses[item.kind]">{{ kindLabels[item.kind] }}</span>
        <time class="text-xs text-muted">{{ dayjs(item.occurredAt).format('MM月DD日 HH:mm:ss') }}</time>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <span v-for="detail in item.details" :key="detail" class="rounded-lg bg-elevated px-2 py-1 text-xs font-medium text-highlighted">{{ detail }}</span>
      </div>
      <p class="mt-1.5 text-xs leading-5 text-muted" :class="compact && 'truncate'">{{ item.description }}</p>
    </article>
  </div>
</template>
```

紧凑模式要求标题、类型和时间尽量同行，指标标签使用更小内边距，说明添加 `truncate`；完整模式允许说明正常换行。

- [ ] **Step 4: 首页改用统一查询与组件**

```ts
const recentRecords = computed(() => store.listHistoryRecords().slice(0, 8))
```

```vue
<section class="grid gap-6 xl:h-[560px] xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.75fr)]">
  <article data-testid="weight-trend-card" class="app-card h-full rounded-3xl p-4 sm:p-6">...</article>
  <article data-testid="recent-records-card" class="app-card flex h-full min-h-0 flex-col overflow-hidden rounded-3xl p-5 sm:p-6">
    <div data-testid="recent-records-viewport" class="relative min-h-0 flex-1 overflow-hidden">
      <UnifiedRecordList :items="recentRecords" compact />
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-default to-transparent" />
    </div>
    <NuxtLink to="/history">查看历史记录 →</NuxtLink>
  </article>
</section>
```

`xl` 以下移除固定高度，组件继续保持紧凑模式；首页不再保留“身体记录/行为记录”两个分散入口。

- [ ] **Step 5: 运行首页用例确认通过**

Run: `pnpm exec playwright test tests/e2e/history.spec.ts --project=desktop --grep "首页最近记录"`

Expected: PASS

- [ ] **Step 6: 提交首页紧凑列表**

```bash
git add app/components/UnifiedRecordList.vue app/pages/index.vue tests/e2e/history.spec.ts
git commit -m "feat: 压缩首页最近记录"
```

### Task 3: 新增只读历史记录页面

**Files:**
- Create: `app/pages/history.vue`
- Modify: `tests/e2e/history.spec.ts`

**Interfaces:**
- Consumes: `store.listHistoryRecords(query)`、`UnifiedRecordList`、`AppDateField`
- Produces: `/history` 页面、`history-kind-filter`、`history-start-date`、`history-end-date`

- [ ] **Step 1: 写入历史页筛选与只读约束的失败测试**

```ts
test('历史记录页统一查看和筛选三类记录且没有写操作', async ({ page }) => {
  await seedHistory(page)
  await page.goto('/history')
  await expect(page.getByRole('heading', { name: '历史记录' })).toBeVisible()
  await expect(page.getByTestId('history-record-item')).toHaveCount(10)
  await page.getByTestId('history-kind-filter').selectOption('training')
  await expect(page.getByTestId('history-record-item')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /编辑|删除|新增/ })).toHaveCount(0)
})
```

- [ ] **Step 2: 运行用例确认因 `/history` 页面不存在而失败**

Run: `pnpm exec playwright test tests/e2e/history.spec.ts --project=desktop --grep "历史记录页"`

Expected: FAIL，页面中不存在“历史记录”标题

- [ ] **Step 3: 实现只读历史页和筛选条件**

```ts
const kind = ref<'all' | HistoryRecordKind>('all')
const start = ref('')
const end = ref('')
const query = computed(() => ({
  kind: kind.value === 'all' ? undefined : kind.value,
  start: start.value ? dayjs(start.value).startOf('day').toISOString() : undefined,
  end: end.value ? dayjs(end.value).endOf('day').toISOString() : undefined,
}))
const records = computed(() => store.listHistoryRecords(query.value))
```

页面使用 `PageHeader` 说明“统一查看身体、训练与睡眠历史数据”，筛选栏包含类型下拉框和两个 `AppDateField`，列表使用 `<UnifiedRecordList :items="records" />`，无结果时显示“当前筛选条件下没有历史记录”。

- [ ] **Step 4: 运行历史页用例确认通过**

Run: `pnpm exec playwright test tests/e2e/history.spec.ts --project=desktop --grep "历史记录页"`

Expected: PASS

- [ ] **Step 5: 提交历史记录页**

```bash
git add app/pages/history.vue tests/e2e/history.spec.ts
git commit -m "feat: 增加只读历史记录页"
```

### Task 4: 全量回归与视觉验收

**Files:**
- Modify only if verification finds an issue

**Interfaces:**
- Consumes: Tasks 1-3 的最终实现
- Produces: 可交付的首页紧凑最近记录和只读历史记录页

- [ ] **Step 1: 运行类型检查**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 2: 运行涉及文件 Lint**

Run: `pnpm exec eslint shared/utils/history.ts app/composables/useTrackFitData.ts app/components/UnifiedRecordList.vue app/pages/index.vue app/pages/history.vue tests/unit/history.test.ts tests/e2e/history.spec.ts`

Expected: PASS

- [ ] **Step 3: 运行全部单元测试**

Run: `pnpm test`

Expected: 所有测试通过

- [ ] **Step 4: 运行相关端到端测试**

Run: `pnpm exec playwright test tests/e2e/history.spec.ts`

Expected: desktop 和 mobile 项目全部通过

- [ ] **Step 5: 执行桌面和移动端视觉检查**

桌面端确认：左右卡片高度一致、右侧无内部滚动条、底部渐隐和历史入口可见。移动端确认：记录紧凑、内容不横向溢出、历史筛选栏纵向排列。

- [ ] **Step 6: 检查最终差异**

Run: `git diff --check && git status --short`

Expected: 无空白错误，仅包含计划内文件
