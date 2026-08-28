<script setup lang="ts">
import { UDrawer, UPopover } from '#components'

defineProps<{
  title: string
  description?: string
  confirmDisabled?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
defineEmits<{ confirm: [] }>()
const { t } = useI18n()
const mobile = ref(false)

onMounted(() => {
  const query = window.matchMedia('(max-width: 639px)')
  mobile.value = query.matches
  const onChange = (event: MediaQueryListEvent) => {
    mobile.value = event.matches
  }
  query.addEventListener('change', onChange)
  onBeforeUnmount(() => query.removeEventListener('change', onChange))
})
</script>

<template>
  <component
    :is="mobile ? UDrawer : UPopover"
    v-model:open="open"
    v-bind="mobile
      ? { title, description, handleOnly: true, ui: { overlay: 'z-[70] bg-slate-950/30', content: 'z-[71] rounded-t-3xl max-h-[calc(100dvh-1rem)]' } }
      : { content: { 'align': 'start', 'sideOffset': 8, 'collisionPadding': 12, 'aria-label': title }, ui: { content: 'z-[70] w-[340px] max-w-[calc(100vw-1.5rem)] rounded-2xl overflow-hidden' } }"
  >
    <slot />
    <template #content>
      <div class="picker-panel flex max-h-[calc(100dvh-3rem)] min-h-0 flex-col sm:max-h-[min(560px,var(--reka-popover-content-available-height))]" data-vaul-no-drag>
        <header class="shrink-0 px-5 pt-5 pb-3">
          <h3 class="text-lg font-semibold text-highlighted">{{ title }}</h3>
          <p v-if="description" class="picker-hint mt-1 text-sm text-muted">{{ description }}</p>
        </header>
        <div class="min-h-0 overflow-y-auto overscroll-contain px-5 pb-3">
          <slot name="content" />
        </div>
        <footer class="grid shrink-0 grid-cols-2 gap-3 border-t border-default bg-default px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" class="min-h-12 rounded-xl border border-default px-4 py-3 font-medium outline-none hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary" @click="open = false">{{ t('common.cancel') }}</button>
          <button type="button" :disabled="confirmDisabled" class="min-h-12 rounded-xl bg-primary px-4 py-3 font-semibold text-white outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" @click="$emit('confirm')">{{ t('date.confirm') }}</button>
        </footer>
      </div>
    </template>
  </component>
</template>

<style scoped>
.picker-panel {
  --wheel-padding: 88px;
  --wheel-height: 220px;
}

@media (min-width: 640px) and (max-height: 800px) {
  .picker-panel {
    --wheel-padding: 44px;
    --wheel-height: 132px;
  }

  .picker-hint {
    display: none;
  }
}
</style>
