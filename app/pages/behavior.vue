<script setup lang="ts">
const localePath = useLocalePath()
const route = useRoute()
await navigateTo({ path: localePath('/history'), query: route.query }, { replace: true, redirectCode: 301 })
</script>

<template>
  <div />
</template>
