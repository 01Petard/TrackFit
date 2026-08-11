<script setup lang="ts">
const { locale, setLocale, t } = useI18n()
const targetLocale = computed<'zh' | 'en'>(() => locale.value === 'zh' ? 'en' : 'zh')
const label = computed(() => targetLocale.value === 'en' ? 'EN' : '中文')
const accessibleLabel = computed(() => t(targetLocale.value === 'en' ? 'common.switchToEnglish' : 'common.switchToChinese'))

async function switchLanguage() {
  await setLocale(targetLocale.value)
}
</script>

<template>
  <button
    type="button"
    class="min-w-8 rounded-lg border border-default px-2 py-1.5 text-xs font-medium text-muted transition hover:border-primary/40 hover:bg-elevated hover:text-highlighted"
    :aria-label="accessibleLabel"
    :title="accessibleLabel"
    @click="switchLanguage"
  >
    {{ label }}
  </button>
</template>
