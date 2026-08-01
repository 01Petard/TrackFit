<script setup lang="ts">
const route = useRoute()
const navigation = [
  { to: '/', label: '概览', icon: 'home' as const },
  { to: '/records', label: '记录', icon: 'records' as const },
  { to: '/analysis', label: '分析', icon: 'analysis' as const },
  { to: '/metrics', label: '指标', icon: 'metrics' as const },
  { to: '/settings', label: '设置', icon: 'settings' as const },
]

function active(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
    <aside class="hidden border-r border-default bg-default/80 px-5 py-7 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:block lg:w-[248px]">
      <NuxtLink to="/" class="mb-10 flex items-center gap-3 px-2">
        <span class="grid size-10 place-items-center rounded-2xl bg-primary font-bold text-white">TF</span>
        <div>
          <strong class="block text-lg tracking-tight">TrackFit</strong>
          <span class="text-xs text-muted">把变化交给数据</span>
        </div>
      </NuxtLink>
      <nav class="space-y-2">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition"
          :class="active(item.to) ? 'bg-primary text-white shadow-lg shadow-primary/15' : 'text-muted hover:bg-elevated hover:text-highlighted'"
        >
          <AppIcon :name="item.icon" class="size-5 shrink-0" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="absolute inset-x-5 bottom-7 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted">
        家庭局域网模式<br>
        数据保存在部署机器的 JSON 文件
      </div>
    </aside>

    <main class="safe-bottom min-w-0 lg:col-start-2">
      <header class="sticky top-0 z-20 border-b border-default bg-default/75 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div class="mx-auto flex max-w-6xl items-center justify-between">
          <NuxtLink to="/" class="flex items-center gap-2 font-bold">
            <span class="grid size-8 place-items-center rounded-xl bg-primary text-xs text-white">TF</span>
            TrackFit
          </NuxtLink>
          <span class="text-xs text-muted">本地数据</span>
        </div>
      </header>
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <slot />
      </div>
    </main>

    <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-default bg-default/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
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
