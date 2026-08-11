# TrackFit Full-Site I18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete Chinese and English UI localization with `/zh/**` and `/en/**` routes, browser-language selection, persisted manual switching, and no changes to persisted TrackFit data.

**Architecture:** Use `@nuxtjs/i18n` for locale-prefixed routes, cookies, head metadata, and Vue message formatting. Keep business data language-neutral: shared analytics return semantic keys and interpolation parameters, while a focused `useTrackFitI18n` composable localizes built-in domain labels, dates, and errors at the UI boundary.

**Tech Stack:** Nuxt 4.5, Vue 3.5, TypeScript 5.9, `@nuxtjs/i18n` 10.x, Vue I18n, Vitest, Playwright

## Global Constraints

- Generate only `/zh/**` and `/en/**` page routes; `/api/**` remains unchanged
- Any `zh` or `zh-*` browser locale selects `/zh/`; every other or unknown locale selects `/en/`
- Persist manual locale selection in a Cookie and preserve path plus query parameters while switching
- Place the compact switch between Logout and GitHub in the desktop and mobile header action group
- Translate system copy and built-in domain labels; never translate user-defined metric names, units, notes, or stored JSON
- Keep ISO timestamps in inputs, APIs, and JSON; localize display values only
- Do not change the v6 data schema or storage format
- Preserve all pre-existing uncommitted history-page work

---

### Task 1: Install and configure Nuxt I18n routing

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `nuxt.config.ts`
- Create: `i18n/locales/zh-CN.ts`
- Create: `i18n/locales/en-US.ts`
- Create: `tests/e2e/i18n-routing.spec.ts`

**Interfaces:**
- Produces locales `zh` and `en`, `localePath()`, `switchLocalePath()`, `setLocale()`, and Cookie key `trackfit_locale`
- Produces initial message namespaces `meta`, `common`, `nav`, `auth`, `errors`, `metrics`, `training`, `dates`, and `pages`
- `tests/e2e/i18n-routing.spec.ts` defines this local helper for authenticated page checks:

```ts
async function loginAsAdmin(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin-pass' },
  })
  expect(response.ok()).toBe(true)
}
```

- [ ] **Step 1: Write the failing routing test**

```ts
test('Chinese browser enters the Chinese prefixed route', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-TW' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page).toHaveURL(/\/zh\/login$/)
  await context.close()
})

test('non-Chinese browser enters the English prefixed route', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ja-JP' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page).toHaveURL(/\/en\/login$/)
  await context.close()
})
```

- [ ] **Step 2: Run the routing tests and verify RED**

Run: `pnpm exec playwright test tests/e2e/i18n-routing.spec.ts --project=desktop`

Expected: FAIL because unprefixed routes and localized login routes do not exist yet.

- [ ] **Step 3: Install and configure the module**

Run: `pnpm add @nuxtjs/i18n@^10.5.0`

Add this configuration shape:

```ts
modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils', '@nuxtjs/i18n'],
i18n: {
  strategy: 'prefix',
  defaultLocale: 'en',
  lazy: true,
  langDir: 'locales',
  locales: [
    { code: 'zh', language: 'zh-CN', file: 'zh-CN.ts', name: '中文' },
    { code: 'en', language: 'en-US', file: 'en-US.ts', name: 'English' },
  ],
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'trackfit_locale',
    redirectOn: 'root',
    fallbackLocale: 'en',
  },
},
```

Create both locale files with matching typed object shapes and enough shell/login messages for the routing test. Move static title, description, and `htmlAttrs.lang` from fixed config into locale-aware `useHead`/`useSeoMeta` in the app shell.

- [ ] **Step 4: Run the routing tests and verify GREEN**

Run: `pnpm exec playwright test tests/e2e/i18n-routing.spec.ts --project=desktop`

Expected: both browser-locale cases pass.

### Task 2: Make authentication and the application shell locale-aware

**Files:**
- Create: `app/components/LanguageSwitch.vue`
- Modify: `app/layouts/default.vue`
- Modify: `app/pages/login.vue`
- Modify: `app/middleware/auth.global.ts`
- Modify: `app/app.vue`
- Modify: `tests/e2e/i18n-routing.spec.ts`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- `LanguageSwitch.vue` consumes `locale`, `switchLocalePath()`, and `setLocale()` and emits no domain events
- Authentication middleware uses `localePath('/login')` and `localePath('/')`

- [ ] **Step 1: Add failing shell and switch tests**

```ts
test('switches locale in place and persists it', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/zh/settings?source=test')
  const actions = page.locator('header .header-actions')
  await expect(actions.getByRole('button', { name: '切换到英文' })).toBeVisible()
  await actions.getByRole('button', { name: '切换到英文' }).click()
  await expect(page).toHaveURL('/en/settings?source=test')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL('/en/settings?source=test')
})
```

Also assert DOM order: logout button, locale button, GitHub link.

- [ ] **Step 2: Run the focused E2E tests and verify RED**

Run: `pnpm exec playwright test tests/e2e/i18n-routing.spec.ts --project=desktop`

Expected: FAIL because `LanguageSwitch` and locale-aware authentication do not exist.

- [ ] **Step 3: Implement the shell and middleware**

Use translated computed navigation entries:

```ts
const navigation = computed(() => [
  { to: localePath('/'), label: t('nav.home'), icon: 'home' as const },
  { to: localePath('/settings'), label: t('nav.settings'), icon: 'settings' as const },
])
```

`LanguageSwitch.vue` derives the destination through `switchLocalePath(targetLocale)` so path and query are preserved. Render it after Logout and before GitHub, including on narrow viewports. On the login page render the same switch in the card header because the default layout is disabled.

- [ ] **Step 4: Run the focused E2E tests and verify GREEN**

Run: `pnpm exec playwright test tests/e2e/i18n-routing.spec.ts --project=desktop --project=mobile`

Expected: routing, persistence, DOM order, and localized authentication pass.

### Task 3: Introduce language-neutral domain presentation contracts

**Files:**
- Create: `app/composables/useTrackFitI18n.ts`
- Create: `shared/utils/domain-error.ts`
- Create: `tests/unit/domain-error.test.ts`
- Modify: `shared/utils/analytics.ts`
- Modify: `tests/unit/analytics.test.ts`
- Modify: `shared/utils/trackfit.ts`
- Modify: `shared/utils/behavior.ts`
- Modify: `app/composables/useTrackFitData.ts`

**Interfaces:**
- `DomainErrorCode` is a string union for known write/read failures
- `TrackFitDomainError` exposes `code` and optional interpolation `values`
- `MetricTrendInsight` exposes semantic `trendKey`, `changeKey`, `evaluationKey`, and `values` instead of localized sentences
- `useTrackFitI18n()` produces `metricName`, `trainingTypeName`, `formatDateTime`, `formatDate`, `formatDuration`, `formatError`, and `formatTrendInsight`

- [ ] **Step 1: Write failing semantic-domain tests**

```ts
test('metric insight returns semantic translation data', () => {
  const result = buildMetricTrendInsight(weightAnalytics)
  expect(result).toMatchObject({
    direction: 'down',
    trendKey: 'insights.direction.down',
    changeKey: 'insights.change.down',
    evaluationKey: 'insights.evaluation.weightDown',
  })
})

test('domain errors carry a stable code', () => {
  expect(() => deleteMeasurement(data, 999)).toThrowError(
    expect.objectContaining({ code: 'measurement.notFound' }),
  )
})
```

- [ ] **Step 2: Run unit tests and verify RED**

Run: `pnpm vitest run tests/unit/analytics.test.ts tests/unit/domain-error.test.ts`

Expected: FAIL because the semantic fields and domain error class do not exist.

- [ ] **Step 3: Implement semantic results and localization helpers**

Define focused contracts such as:

```ts
export interface LocalizedDescriptor {
  key: string
  values?: Record<string, string | number>
}

export interface MetricTrendInsight {
  direction: 'up' | 'down' | 'stable' | 'insufficient'
  trend: LocalizedDescriptor
  change: LocalizedDescriptor
  evaluation: LocalizedDescriptor
  tone: 'positive' | 'warning' | 'neutral'
}
```

Replace display-facing Chinese exceptions in mutation helpers with `TrackFitDomainError`. Keep CSV cell data and user data untouched. `useTrackFitI18n` maps core metric codes only; custom metric names return `metric.name` unchanged.

- [ ] **Step 4: Run unit tests and verify GREEN**

Run: `pnpm vitest run tests/unit/analytics.test.ts tests/unit/domain-error.test.ts tests/unit/trackfit.test.ts tests/unit/behavior.test.ts`

Expected: all affected domain tests pass.

### Task 4: Localize reusable components

**Files:**
- Modify: `app/components/AppDateField.vue`
- Modify: `app/components/BehaviorDialog.vue`
- Modify: `app/components/ComparisonChart.client.vue`
- Modify: `app/components/ManagerDialog.vue`
- Modify: `app/components/MeasurementDialog.vue`
- Modify: `app/components/MetricChart.client.vue`
- Modify: `app/components/MetricsManager.vue`
- Modify: `app/components/RecordsManager.vue`
- Modify: `app/components/UnifiedRecordList.vue`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `tests/e2e/history.spec.ts`

**Interfaces:**
- Components call `t()` for static system copy and `useTrackFitI18n()` for domain labels and display dates
- Existing props, emitted events, and persisted values remain unchanged

- [ ] **Step 1: Add failing component-flow assertions**

Extend E2E coverage to open measurement, metric, behavior, records, and history interfaces under `/en/**`, asserting representative labels (`Save record`, `Metric name`, `Training`, `Sleep`, `Today`) and localized dates. Add a custom metric named `睡眠质量` and assert the English page still shows exactly `睡眠质量`.

- [ ] **Step 2: Run the component-flow tests and verify RED**

Run: `pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/history.spec.ts --project=desktop`

Expected: FAIL on the first English label because components still contain Chinese literals.

- [ ] **Step 3: Replace component system literals with message keys**

For interpolated and pluralized labels use Vue I18n parameters:

```vue
<span>{{ t('common.minutes', { count: durationMinutes }, durationMinutes) }}</span>
```

Use locale-aware date formatting for display buttons and table cells, while continuing to emit the existing ISO strings. Translate confirm dialogs and accessible names. Do not translate free-text notes or custom metric fields.

- [ ] **Step 4: Run the component-flow tests and verify GREEN**

Run: `pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/history.spec.ts --project=desktop --project=mobile`

Expected: reusable dialogs, managers, charts, and record lists pass in both viewports.

### Task 5: Localize every page and dynamic dashboard sentence

**Files:**
- Modify: `app/pages/index.vue`
- Modify: `app/pages/settings.vue`
- Modify: `app/pages/analysis.vue`
- Modify: `app/pages/behavior.vue`
- Modify: `app/pages/history.vue`
- Modify: `app/pages/records.vue`
- Modify: `app/pages/metrics.vue`
- Modify: `i18n/locales/zh-CN.ts`
- Modify: `i18n/locales/en-US.ts`
- Modify: `tests/e2e/i18n-routing.spec.ts`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `tests/e2e/history.spec.ts`

**Interfaces:**
- Pages use `localePath()` for internal links
- Dynamic dashboard copy is built with semantic descriptors and `t(key, values)`
- Locale files keep identical key structures

- [ ] **Step 1: Add failing full-page assertions**

Add a parameterized E2E test that visits all supported English pages and checks their primary heading:

```ts
for (const [path, heading] of [
  ['/en/', 'Body overview'],
  ['/en/settings', 'Settings'],
  ['/en/analysis', 'Analysis'],
  ['/en/behavior', 'Behavior records'],
  ['/en/history', 'History'],
] as const) {
  test(`${path} renders in English`, async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  })
}
```

Add assertions for English trend insight text, core metric labels, and an internal link retaining `/en/`.

- [ ] **Step 2: Run full-page E2E and verify RED**

Run: `pnpm exec playwright test tests/e2e/i18n-routing.spec.ts tests/e2e/smoke.spec.ts tests/e2e/history.spec.ts --project=desktop`

Expected: FAIL where pages and dashboard sentences still contain Chinese.

- [ ] **Step 3: Migrate all page copy and complete locale dictionaries**

Replace literal UI strings, template literals, select options, warnings, summary text, chart legends, and confirmation text with translation keys. Use computed translated collections so runtime locale changes update existing views without a reload. Localize core metric names through `metricName()` and leave custom metric names unchanged.

Search before finishing this task:

Run: `rg -n --glob '*.{vue,ts}' '[\\p{Han}]' app`

Every remaining Han literal must be one of: `中文` switch label, a user-data fixture/example, or an intentional developer comment. Move every other user-visible literal into `zh-CN.ts`.

- [ ] **Step 4: Run full-page E2E and verify GREEN**

Run: `pnpm exec playwright test tests/e2e/i18n-routing.spec.ts tests/e2e/smoke.spec.ts tests/e2e/history.spec.ts --project=desktop --project=mobile`

Expected: all localized page and interaction tests pass.

### Task 6: Localize API error presentation without changing API paths

**Files:**
- Modify: `server/api/auth/login.post.ts`
- Modify: `server/api/data/index.put.ts`
- Modify: `server/utils/auth.ts`
- Modify: `app/pages/login.vue`
- Modify: `app/composables/useTrackFitData.ts`
- Modify: `i18n/locales/zh-CN.ts`
- Modify: `i18n/locales/en-US.ts`
- Modify: `tests/unit/auth.test.ts`
- Modify: `tests/e2e/i18n-routing.spec.ts`

**Interfaces:**
- API errors expose `data.code` with stable values such as `auth.invalidCredentials`, `auth.unauthorized`, `data.versionMissing`, `data.conflict`, and `data.invalid`
- UI calls `formatError(error)` and never displays raw server `statusMessage` when a known code exists

- [ ] **Step 1: Add failing error-code and English UI tests**

```ts
test('invalid credentials expose a stable error code', async () => {
  const response = await request.post('/api/auth/login', {
    data: { username: 'wrong', password: 'wrong' },
  })
  expect(response.status()).toBe(401)
  expect(await response.json()).toMatchObject({ data: { code: 'auth.invalidCredentials' } })
})
```

Add an E2E assertion that `/en/login` displays `Incorrect username or password` for this response.

- [ ] **Step 2: Run error tests and verify RED**

Run: `pnpm vitest run tests/unit/auth.test.ts && pnpm exec playwright test tests/e2e/i18n-routing.spec.ts --project=desktop`

Expected: FAIL because APIs expose Chinese status messages without codes.

- [ ] **Step 3: Add stable error codes and client mapping**

Attach codes through H3 error `data`, retain concise fallback `statusMessage` for non-UI API clients, and map codes to `errors.*` locale keys. Unknown errors use localized generic fallbacks; validation details shown in forms come from localized client validation.

- [ ] **Step 4: Run error tests and verify GREEN**

Run: `pnpm vitest run tests/unit/auth.test.ts && pnpm exec playwright test tests/e2e/i18n-routing.spec.ts --project=desktop`

Expected: stable API codes and localized error UI pass.

### Task 7: Complete regression and build verification

**Files:**
- Modify: affected tests only when a verified locale-prefixed contract requires it
- Modify: `README.md` with the supported route and locale behavior

**Interfaces:**
- No new runtime interfaces

- [ ] **Step 1: Update documentation and inspect scope**

Document `/zh/**`, `/en/**`, browser detection, Cookie persistence, and the switch location. Run `git diff --check` and inspect `git diff --stat` plus `git status --short` to ensure unrelated user changes were not discarded.

- [ ] **Step 2: Run static verification**

Run: `pnpm typecheck && pnpm lint`

Expected: exit 0 with no TypeScript or ESLint errors.

- [ ] **Step 3: Run all unit and E2E tests**

Run: `pnpm test && pnpm test:e2e`

Expected: every Vitest and Playwright test passes in configured desktop and mobile projects.

- [ ] **Step 4: Run production build**

Run: `pnpm build`

Expected: Nuxt production build exits 0 and generates locale-prefixed routes without module warnings.

- [ ] **Step 5: Review requirements against the design**

Re-read `docs/superpowers/specs/2026-08-11-full-site-i18n-design.md`, inspect the final diff, and confirm each routing, interaction, translation-boundary, error, date, and non-goal requirement has direct implementation or test evidence.
