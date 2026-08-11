export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils', '@nuxtjs/i18n'],
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      meta: [
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
  i18n: {
    strategy: 'prefix',
    defaultLocale: 'en',
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
})
