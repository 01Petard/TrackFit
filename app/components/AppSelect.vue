<script setup lang="ts">
defineProps<{
  label: string
  items: Array<{ label: string, value: string }>
}>()
const model = defineModel<string>({ required: true })
const inputId = useId()
</script>

<template>
  <div class="min-w-0">
    <label :for="inputId" class="mb-1.5 block text-xs font-medium text-muted">{{ label }}</label>
    <USelect
      :id="inputId"
      v-model="model"
      :items="items"
      size="lg"
      class="w-full"
      :content="{ position: 'popper', sideOffset: 6, collisionPadding: 12 }"
      :ui="{
        base: 'min-h-11 rounded-xl bg-white px-3.5 text-sm text-highlighted ring-1 ring-inset ring-[#d9e6ef] focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:ring-2 data-[state=open]:ring-primary',
        trailing: 'pe-3.5',
        content: 'z-50 rounded-xl bg-white p-1 ring-1 ring-default shadow-lg',
        group: 'p-0',
        item: 'min-h-10 items-center rounded-lg px-3 py-2 text-sm data-highlighted:not-data-disabled:text-primary data-highlighted:not-data-disabled:before:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:before:bg-primary/5',
      }"
    >
      <template #trailing="{ open }">
        <AppIcon name="chevronRight" class="size-4 text-muted" :class="open ? '-rotate-90' : 'rotate-90'" />
      </template>
      <template #item="{ item }">
        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
        <AppIcon v-if="item.value === model" name="check" class="size-4 shrink-0 text-primary" />
      </template>
    </USelect>
  </div>
</template>
