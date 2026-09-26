<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="mb-1 text-[11px] font-bold uppercase tracking-[0.27em] text-[#07b667]">TrackFit</p>
      <h1 class="text-[29px] font-extrabold leading-tight tracking-tight text-[#152949] sm:text-[38px]">{{ title }}</h1>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-[#617899] sm:text-[15px]">{{ description }}</p>
    </div>
    <div class="shrink-0">
      <slot />
    </div>
  </header>
</template>
