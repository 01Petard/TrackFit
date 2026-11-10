<script setup lang="ts" generic="T extends string | number">
import type { SelectItem } from '@nuxt/ui'

withDefaults(defineProps<{
  label: string
  items: Array<{ label: string, value: T }>
  disabled?: boolean
  labelClass?: string
}>(), {
  disabled: false,
  labelClass: 'mb-1.5 block text-xs font-medium text-muted',
})
const model = defineModel<T>({ required: true })
const inputId = useId()

// USelect 的 item 插槽类型是 SelectItem 联合类型，本组件的 items 恒为对象项。
function itemLabel(item: unknown) {
  return (item as { label?: string } | null)?.label
}

function isSelected(item: unknown) {
  return (item as { value?: T } | null)?.value === model.value
}
</script>

<template>
  <div class="min-w-0">
    <label :for="inputId" :class="labelClass">{{ label }}</label>
    <USelect
      :id="inputId"
      :model-value="model"
      :items="items as SelectItem[]"
      :disabled="disabled"
      size="lg"
      class="w-full"
      :content="{ position: 'popper', sideOffset: 6, collisionPadding: 12 }"
      :ui="{
        base: 'min-h-11 rounded-xl bg-white px-3.5 text-sm text-highlighted ring-1 ring-inset ring-[#d9e6ef] focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:ring-2 data-[state=open]:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
        value: 'truncate',
        trailing: 'pe-3.5',
        content: 'z-[70] rounded-xl bg-white p-1 ring-1 ring-default shadow-lg',
        group: 'p-0',
        item: 'min-h-10 items-center rounded-lg px-3 py-2 text-sm data-highlighted:not-data-disabled:text-primary data-highlighted:not-data-disabled:before:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:before:bg-primary/5',
      }"
      @update:model-value="model = $event as T"
    >
      <template #trailing="{ open }">
        <AppIcon name="chevronRight" class="size-4 text-muted" :class="open ? '-rotate-90' : 'rotate-90'" />
      </template>
      <template #item="{ item }">
        <span class="min-w-0 flex-1 truncate">{{ itemLabel(item) }}</span>
        <AppIcon v-if="isSelected(item)" name="check" class="size-4 shrink-0 text-primary" />
      </template>
    </USelect>
  </div>
</template>
