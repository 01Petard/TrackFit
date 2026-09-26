<script setup lang="ts">
defineProps<{
  name: 'home' | 'records' | 'analysis' | 'metrics' | 'settings' | 'plus' | 'edit' | 'save' | 'close' | 'calendar' | 'clock' | 'github'
    | 'weight' | 'bmi' | 'waist' | 'percent' | 'run' | 'moon' | 'target' | 'streak' | 'sparkles' | 'file' | 'dumbbell' | 'walk' | 'stretch'
    | 'database' | 'download' | 'upload' | 'user' | 'heart' | 'trophy' | 'link' | 'shield' | 'refresh' | 'chevronRight' | 'arrowRight' | 'info' | 'eye' | 'filter' | 'expand' | 'chart' | 'barChart'
}>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'home'">
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </template>
    <template v-else-if="name === 'records'">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke-width="3" />
    </template>
    <template v-else-if="name === 'analysis'">
      <path d="M4 19V5M4 19h16" />
      <path d="m7 15 4-4 3 2 5-6" />
    </template>
    <template v-else-if="name === 'metrics'">
      <path d="M4 17V9M10 17V5M16 17v-3M22 17V7" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.37.36.7.6 1 .29.3.68.44 1.1.4h.09v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </template>
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <template v-else-if="name === 'edit'">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </template>
    <template v-else-if="name === 'save'">
      <path d="M5 3h12l2 2v16H5Z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </template>
    <path v-else-if="name === 'close'" d="m6 6 12 12M18 6 6 18" />
    <template v-else-if="name === 'calendar'">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'github'">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.3 4 5 5 0 0 0 19.1.5S18 0 15 1.8a13.4 13.4 0 0 0-7 0C5 0 3.9.5 3.9.5A5 5 0 0 0 3.7 4a5.4 5.4 0 0 0-1.5 3.7c0 5.4 3.5 6.6 6.8 7A4.8 4.8 0 0 0 8 18v4" />
      <path d="M8 19c-3 .9-3-1.5-4-2" />
    </template>
    <template v-else-if="name === 'weight'">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M8 10a4 4 0 0 1 8 0M12 10l2-2" />
      <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'bmi' || name === 'chart'">
      <path d="M3 18h18M5 15l5-5 4 3 5-7" />
      <path d="M15 6h4v4" />
    </template>
    <template v-else-if="name === 'waist'">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 12v3M9 12v2M12 12v3M15 12v2M18 12v3" />
    </template>
    <template v-else-if="name === 'percent'">
      <path d="M18.5 5.5l-13 13" />
      <circle cx="7" cy="7" r="2.25" />
      <circle cx="17" cy="17" r="2.25" />
    </template>
    <template v-else-if="name === 'run'">
      <circle cx="15" cy="4" r="2" />
      <path d="m12 8-3 3 4 2 2 4M12 8l5 2 3 3M9 11 5 12M13 13l-4 6-4 2M15 17l4 4" />
    </template>
    <path v-else-if="name === 'moon'" d="M20 14.1A8.4 8.4 0 0 1 9.9 4a8.5 8.5 0 1 0 10.2 10.1Z" />
    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'streak'">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18m-13 5 2 2 5-5" />
    </template>
    <template v-else-if="name === 'sparkles'">
      <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2ZM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16ZM19 15l.6 1.4L21 17l-1.4.6L19 19l-.6-1.4L17 17l1.4-.6L19 15Z" />
    </template>
    <template v-else-if="name === 'file'">
      <path d="M5 2h9l5 5v15H5zM14 2v6h5M9 12h6M9 16h6" />
    </template>
    <template v-else-if="name === 'dumbbell'">
      <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
    </template>
    <template v-else-if="name === 'walk'">
      <circle cx="13" cy="4" r="2" /><path d="m11 8-2 5 3 2 1 6M11 8l4 3 4 1M9 13l-5 2M12 15l-5 6" />
    </template>
    <template v-else-if="name === 'stretch'">
      <circle cx="14" cy="4" r="2" /><path d="m12 8-2 6 4 2 1 5M12 8l5 5 3 1M10 14l-5 7" />
    </template>
    <template v-else-if="name === 'database'">
      <ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="7" r="4" /><path d="M4 21c0-4.4 3.2-7 8-7s8 2.6 8 7" />
    </template>
    <path v-else-if="name === 'heart'" d="M20.8 8.5c0 4.6-8.8 10.8-8.8 10.8S3.2 13.1 3.2 8.5A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.8 2.1Z" />
    <template v-else-if="name === 'trophy'">
      <path d="M7 3h10v5c0 4-2 7-5 7S7 12 7 8V3ZM7 5H4v3c0 2 1.5 3 3 3M17 5h3v3c0 2-1.5 3-3 3M12 15v4m-4 2h8" />
    </template>
    <template v-else-if="name === 'link'">
      <path d="M9 15l6-6M8 11 6 13a4 4 0 0 0 6 6l2-2M16 13l2-2a4 4 0 0 0-6-6l-2 2" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 2 20 5v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3Z" /><path d="m8 12 3 3 5-5" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5" />
    </template>
    <path v-else-if="name === 'chevronRight'" d="m9 5 7 7-7 7" />
    <path v-else-if="name === 'arrowRight'" d="M4 12h16m-6-6 6 6-6 6" />
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" />
    </template>
    <template v-else-if="name === 'eye'">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" />
    </template>
    <template v-else-if="name === 'filter'">
      <path d="M3 5h18M6 12h12M9 19h6" />
    </template>
    <template v-else-if="name === 'expand'">
      <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
    </template>
    <template v-else-if="name === 'barChart'">
      <path d="M4 20V12m5 8V6m5 14v-9m5 9V3" />
    </template>
  </svg>
</template>
