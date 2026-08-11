<script setup lang="ts">
definePageMeta({ layout: false })

const { fetch: refreshSession } = useUserSession()
const { t } = useI18n()
const { formatError } = useTrackFitI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const username = ref('')
const password = ref('')
const submitting = ref(false)
const message = ref('')
const viewerCredentials = computed(() => {
  const credentials = config.public.viewerCredentials
  return credentials.username && credentials.password ? credentials : null
})

async function login() {
  submitting.value = true
  message.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await refreshSession()
    await navigateTo(localePath('/'))
  } catch (error) {
    const payload = error as { data?: { data?: { code?: 'auth.invalidCredentials' } } }
    message.value = payload.data?.data?.code
      ? formatError(new TrackFitDomainError(payload.data.data.code))
      : t('auth.loginFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="relative z-10 grid min-h-screen place-items-center px-4 py-10">
    <section class="app-card w-full max-w-md rounded-3xl p-6 shadow-xl sm:p-8">
      <div class="mb-7 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <LiquidLogo :size="48" />
          <div>
            <h1 class="text-xl font-bold">TrackFit</h1>
            <p class="mt-1 text-xs text-muted">{{ t('meta.tagline') }}</p>
          </div>
        </div>
        <LanguageSwitch />
      </div>

      <div v-if="viewerCredentials" class="mb-5 rounded-2xl border border-default bg-elevated px-4 py-3 text-sm">
        <p class="text-xs text-muted">{{ t('auth.viewerCredentials') }}：{{ viewerCredentials.username }} {{ viewerCredentials.password }}</p>
      </div>

      <form class="space-y-5" @submit.prevent="login">
        <label class="block text-sm">{{ t('auth.username') }}<input
          v-model="username" required autocomplete="username" maxlength="100"
          class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3 outline-none focus:border-primary"
        ></label>
        <label class="block text-sm">{{ t('auth.password') }}<input
          v-model="password" required type="password" autocomplete="current-password" maxlength="256"
          class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3 outline-none focus:border-primary"
        ></label>
        <p v-if="message" role="alert" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ message }}</p>
        <button :disabled="submitting" class="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-60">{{ t(submitting ? 'auth.loggingIn' : 'auth.login') }}</button>
      </form>
    </section>
  </main>
</template>
