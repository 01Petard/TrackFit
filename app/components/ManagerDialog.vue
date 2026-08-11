<script setup lang="ts">
const props = defineProps<{
  open: boolean
  kind: 'records' | 'metrics'
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const title = computed(() => t(props.kind === 'records' ? 'common.measurementRecords' : 'common.metricManagement'))
</script>

<template>
  <Teleport to="body">
    <Transition name="manager-dialog">
      <div v-if="open" class="fixed inset-0 z-40 grid items-end bg-slate-950/45 backdrop-blur-sm lg:place-items-center lg:p-5" @click.self="emit('update:open', false)">
        <section role="dialog" aria-modal="true" :aria-label="title" class="relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-default px-4 py-6 shadow-2xl sm:px-6 lg:max-w-7xl lg:rounded-3xl lg:px-8 lg:py-8">
          <button type="button" :aria-label="t('common.closeNamed', { name: title })" class="sticky top-0 z-10 float-right grid size-10 place-items-center rounded-full border border-default bg-default/90 text-xl text-muted shadow-sm backdrop-blur hover:text-highlighted" @click="emit('update:open', false)">×</button>
          <Suspense>
            <RecordsManager v-if="kind === 'records'" />
            <MetricsManager v-else />
            <template #fallback><div class="grid min-h-72 place-items-center text-sm text-muted">{{ t('common.loading') }}</div></template>
          </Suspense>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.manager-dialog-enter-active,
.manager-dialog-leave-active { transition: opacity .22s ease; }
.manager-dialog-enter-active section,
.manager-dialog-leave-active section { transition: transform .22s ease; }
.manager-dialog-enter-from,
.manager-dialog-leave-to { opacity: 0; }
.manager-dialog-enter-from section,
.manager-dialog-leave-to section { transform: translateY(1rem) scale(.985); }
</style>
