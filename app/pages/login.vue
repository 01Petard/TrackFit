<script setup lang="ts">
definePageMeta({layout: false})

const {fetch: refreshSession} = useUserSession()
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
      body: {username: username.value, password: password.value},
    })
    await refreshSession()
    await navigateTo('/')
  } catch (error) {
    const payload = error as { data?: { statusMessage?: string } }
    message.value = payload.data?.statusMessage ?? '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="relative z-10 grid min-h-screen place-items-center px-4 py-10">
    <section class="app-card w-full max-w-md rounded-3xl p-6 shadow-xl sm:p-8">
      <div class="mb-7 flex items-center gap-3">
        <LiquidLogo :size="48"/>
        <div><h1 class="text-xl font-bold">TrackFit</h1>
          <p class="mt-1 text-xs text-muted">把变化交给数据</p></div>
      </div>

      <div v-if="viewerCredentials" class="mb-5 rounded-2xl border border-default bg-elevated px-4 py-3 text-sm">
        <p class="text-xs text-muted">访客账号：{{ viewerCredentials.username }} {{ viewerCredentials.password }}</p>
      </div>

      <form class="space-y-5" @submit.prevent="login">
        <label class="block text-sm">用户名<input v-model="username" required autocomplete="username" maxlength="100"
                                                  class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3 outline-none focus:border-primary"></label>
        <label class="block text-sm">密码<input v-model="password" required type="password" autocomplete="current-password" maxlength="256"
                                                class="mt-2 w-full rounded-xl border border-default bg-default px-4 py-3 outline-none focus:border-primary"></label>
        <p v-if="message" role="alert" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ message }}</p>
        <button :disabled="submitting" class="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-60">{{ submitting ? '登录中…' : '登录' }}</button>
      </form>
    </section>
  </main>
</template>
