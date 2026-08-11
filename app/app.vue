<script setup lang="ts">
const { locale, t } = useI18n()

useHead(() => ({
  htmlAttrs: { lang: locale.value === 'zh' ? 'zh-CN' : 'en-US' },
  title: t('meta.title'),
  meta: [{ name: 'description', content: t('meta.description') }],
}))
</script>

<template>
  <UApp>
    <AmbientParticles />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
