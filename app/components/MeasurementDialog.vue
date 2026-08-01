<script setup lang="ts">
import type { MeasurementDto } from '../../shared/types/api'
import dayjs from 'dayjs'

const props = defineProps<{
  open: boolean
  measurement?: MeasurementDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const store = useTrackFitData()
await store.ensureLoaded()
const metrics = store.metrics
const measuredAt = ref('')
const note = ref('')
const values = reactive<Record<number, string>>({})
const saving = ref(false)
const errorMessage = ref('')

const enabledMetrics = computed(() => metrics.value.filter(metric => metric.enabled))
const weightMetric = computed(() => enabledMetrics.value.find(metric => metric.code === 'weight'))
const otherMetrics = computed(() => enabledMetrics.value.filter(metric => metric.code !== 'weight'))

watch(() => props.open, (open) => {
  if (!open) return
  errorMessage.value = ''
  measuredAt.value = dayjs(props.measurement?.measuredAt ?? new Date()).format('YYYY-MM-DDTHH:mm:ss')
  note.value = props.measurement?.note ?? ''
  for (const key of Object.keys(values)) delete values[Number(key)]
  for (const item of props.measurement?.values ?? []) values[item.metricId] = String(item.value)
}, { immediate: true })

async function save() {
  const payloadValues = Object.entries(values)
    .filter(([, value]) => value !== '')
    .map(([metricId, value]) => ({ metricId: Number(metricId), value: Number(value) }))
  if (!payloadValues.length) {
    errorMessage.value = '至少填写一个身体指标'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    await store.saveMeasurement({
      measuredAt: new Date(measuredAt.value).toISOString(),
      note: note.value || null,
      values: payloadValues,
    }, props.measurement?.id)
    emit('update:open', false)
    emit('saved')
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    saving.value = false
  }
}

const getErrorMessage = getTrackFitErrorMessage
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="fixed inset-0 z-50 grid items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" @click.self="emit('update:open', false)">
        <section role="dialog" aria-modal="true" class="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-default p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
          <header class="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold">{{ measurement ? '编辑测量记录' : '记录身体数据' }}</h2>
              <p class="mt-1 text-sm text-muted">同一天可以记录任意多次，每次数据都会独立保存</p>
            </div>
            <button class="grid size-9 place-items-center rounded-full bg-elevated text-muted hover:text-highlighted" @click="emit('update:open', false)">×</button>
          </header>

          <form class="space-y-5" @submit.prevent="save">
            <div class="block">
              <span class="mb-2 flex items-center justify-between text-sm font-medium">测量时间 <span class="text-xs font-normal text-muted">默认为当前时间，可点击修改</span></span>
              <AppDateField v-model="measuredAt" mode="datetime" placeholder="选择测量时间" />
            </div>

            <label v-if="weightMetric" class="block rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <span class="mb-2 flex items-center justify-between text-sm font-semibold">
                体重
                <span class="font-normal text-muted">{{ weightMetric.unit }}</span>
              </span>
              <input
                v-model="values[weightMetric.id]"
                inputmode="decimal"
                type="number"
                :step="10 ** -weightMetric.decimalPlaces"
                :min="weightMetric.minimumValue ?? undefined"
                :max="weightMetric.maximumValue ?? undefined"
                placeholder="例如 72.5"
                class="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted/35"
              >
            </label>

            <section v-if="otherMetrics.length" class="rounded-2xl border border-default p-4">
              <div class="mb-4"><h3 class="font-medium">其他身体指标</h3><p class="mt-1 text-xs text-muted">所有已启用指标均可直接填写</p></div>
              <div class="grid gap-4 sm:grid-cols-2">
                <label v-for="metric in otherMetrics" :key="metric.id" class="block">
                  <span class="mb-1.5 flex justify-between text-sm">
                    {{ metric.name }}
                    <span class="text-muted">{{ metric.unit }}</span>
                  </span>
                  <input
                    v-model="values[metric.id]"
                    inputmode="decimal"
                    type="number"
                    :step="10 ** -metric.decimalPlaces"
                    :min="metric.minimumValue ?? undefined"
                    :max="metric.maximumValue ?? undefined"
                    class="w-full rounded-xl border border-default bg-default px-3 py-2.5 outline-none focus:border-primary"
                  >
                </label>
              </div>
            </section>

            <label class="block">
              <span class="mb-2 block text-sm font-medium">备注 <span class="font-normal text-muted">可选</span></span>
              <textarea v-model="note" maxlength="500" rows="3" class="w-full resize-none rounded-xl border border-default bg-default px-4 py-3 outline-none focus:border-primary" placeholder="记录当时值得关注的信息" />
            </label>

            <p v-if="errorMessage" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{{ errorMessage }}</p>

            <div class="flex gap-3 pt-1">
              <button type="button" class="flex-1 rounded-xl border border-default px-4 py-3 font-medium hover:bg-elevated" @click="emit('update:open', false)">取消</button>
              <button type="submit" :disabled="saving" class="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {{ saving ? '保存中…' : '保存记录' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active { transition: opacity .2s ease; }
.dialog-enter-active section,
.dialog-leave-active section { transition: transform .2s ease; }
.dialog-enter-from,
.dialog-leave-to { opacity: 0; }
.dialog-enter-from section,
.dialog-leave-to section { transform: translateY(1.5rem) scale(.98); }
</style>
