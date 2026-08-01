export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'TrackFit',
      meta: [
        { name: 'description', content: '个人身体指标记录与趋势分析' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#10b981' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  ui: {
    fonts: false,
  },
  runtimeConfig: {
    dataFile: process.env.TRACKFIT_DATA_FILE ?? '',
  },
  compatibilityDate: '2026-07-31',
  typescript: {
    strict: true,
    typeCheck: true,
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
