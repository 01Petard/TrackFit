<script setup lang="ts">
const route = useRoute()
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
        <span class="text-xs text-muted lg:hidden">本地数据</span>
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
