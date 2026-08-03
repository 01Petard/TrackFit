<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 36 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none" aria-hidden="true" class="shrink-0 overflow-visible">
    <defs>
      <linearGradient id="liquid-logo-gradient" x1="12" y1="8" x2="52" y2="57" gradientUnits="userSpaceOnUse">
        <stop stop-color="#86EFAC" />
        <stop offset="0.5" stop-color="#10B981" />
        <stop offset="1" stop-color="#047857" />
      </linearGradient>
      <filter id="liquid-logo-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
    <path d="M12 38C18 39 18 17 29 16C40 15 38 44 49 45C53 45 55 42 57 38" stroke="url(#liquid-logo-gradient)" stroke-width="13" stroke-linecap="round" opacity=".2" filter="url(#liquid-logo-glow)" />
    <path d="M10 39C18 41 18 16 29 15C41 14 38 46 50 47C55 47 58 43 59 39" stroke="url(#liquid-logo-gradient)" stroke-width="8" stroke-linecap="round" />
  </svg>
</template>
