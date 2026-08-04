export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils'],
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'TrackFit 形轨｜记录身体变化，看见习惯的影响',
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
    storage: process.env.TRACKFIT_STORAGE ?? 'file',
    blobPath: process.env.TRACKFIT_BLOB_PATH ?? 'trackfit/trackfit-data.json',
    session: {
      password: process.env.NUXT_SESSION_PASSWORD ?? '',
      maxAge: 60 * 60 * 24 * 7,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    },
    public: {
      viewerCredentials: {
        username: process.env.TRACKFIT_VIEWER_DISPLAY_USERNAME ?? '',
        password: process.env.TRACKFIT_VIEWER_DISPLAY_PASSWORD ?? '',
      },
    },
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
