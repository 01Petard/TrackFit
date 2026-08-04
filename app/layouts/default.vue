<script setup lang="ts">
const route = useRoute()
const { user, clear } = useUserSession()
const navigation = [
  { to: '/', label: '主页', icon: 'home' as const },
  { to: '/settings', label: '设置', icon: 'settings' as const },
]
const headerVisible = ref(true)
let previousScrollY = 0

function active(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

function syncHeaderVisibility() {
  const currentScrollY = window.scrollY
  const distance = currentScrollY - previousScrollY
  if (currentScrollY < 24) headerVisible.value = true
  else if (Math.abs(distance) >= 8) headerVisible.value = distance < 0
  previousScrollY = currentScrollY
}

async function logout() {
  await clear()
  await navigateTo('/login')
}

onMounted(() => {
  previousScrollY = window.scrollY
  window.addEventListener('scroll', syncHeaderVisibility, { passive: true })
})

onBeforeUnmount(() => window.removeEventListener('scroll', syncHeaderVisibility))
</script>

<template>
  <div class="relative z-10 min-h-screen">
    <header class="sticky top-0 z-30 bg-transparent px-4 py-3 backdrop-blur-md transition-transform duration-300 ease-out will-change-transform sm:px-6 lg:px-10" :class="headerVisible ? 'translate-y-0' : '-translate-y-full'">
      <div class="mx-auto flex max-w-7xl items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5 font-bold">
          <LiquidLogo :size="38" />
          <span>
            <strong class="block leading-tight">TrackFit</strong>
            <span class="hidden text-[11px] font-normal text-muted sm:block">把变化交给数据</span>
          </span>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <nav class="hidden items-center gap-2 lg:flex" aria-label="主导航">
            <NuxtLink
              v-for="item in navigation"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-elevated hover:text-highlighted"
            >
              <AppIcon :name="item.icon" class="size-4 shrink-0" />
              {{ item.label }}
            </NuxtLink>
          </nav>
          <span class="rounded-full bg-elevated px-2.5 py-1 text-[11px] text-muted">{{ user?.role === 'admin' ? '管理员' : '只读访客' }}</span>
          <button class="rounded-lg border border-default px-2.5 py-1.5 text-xs text-muted hover:text-highlighted" @click="logout">退出</button>
          <a
            href="https://github.com/01Petard/TrackFit"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库：01Petard/TrackFit"
            title="GitHub 仓库：01Petard/TrackFit"
            class="grid size-8 place-items-center rounded-lg border border-default text-muted transition hover:border-primary/40 hover:bg-elevated hover:text-highlighted"
          >
            <AppIcon name="github" class="size-[18px]" />
          </a>
        </div>
      </div>
    </header>

    <main class="safe-bottom min-w-0">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <slot />
      </div>
    </main>

    <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-default bg-default/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="移动端主导航">
      <NuxtLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        class="flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px]"
        :class="active(item.to) ? 'text-primary' : 'text-muted'"
      >
        <AppIcon :name="item.icon" class="size-[22px]" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
