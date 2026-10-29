import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts'
import { ref } from 'vue'

interface LineEvent {
  componentType?: string
  seriesName?: string
}

export function useChartLineFocus() {
  const hovered = ref<string | null>(null)
  const selected = ref<string | null>(null)

  function onMouseOver(event: LineEvent) {
    if (event.componentType === 'series' && event.seriesName) hovered.value = event.seriesName
  }

  function onMouseOut() {
    hovered.value = null
  }

  function onClick(event: LineEvent) {
    if (event.componentType !== 'series' || !event.seriesName) return
    selected.value = selected.value === event.seriesName ? null : event.seriesName
  }

  function onBlankClick(event: { target?: unknown }) {
    if (!event.target) {
      selected.value = null
      hovered.value = null
    }
  }

  function focusSeries<T extends LineSeriesOption | BarSeriesOption>(series: T[]): T[] {
    const focused = hovered.value ?? selected.value
    const hasFocus = series.some(item => item.name === focused)
    return series.map((item) => {
      const active = hasFocus && item.name === focused
      const opacity = hasFocus && !active ? 0.15 : 1
      if (item.type === 'bar') return { ...item, emphasis: { disabled: true }, itemStyle: { ...item.itemStyle, opacity } }
      return {
        ...item,
        triggerEvent: 'line',
        emphasis: { disabled: true },
        lineStyle: { ...('lineStyle' in item ? item.lineStyle : {}), opacity },
        itemStyle: { ...item.itemStyle, opacity },
        ...('areaStyle' in item && item.areaStyle ? { areaStyle: { ...item.areaStyle, opacity: hasFocus && !active ? 0.1 : item.areaStyle.opacity ?? 0.7 } } : {}),
      }
    })
  }

  function onLegendClick(name: string) {
    hovered.value = null
    selected.value = selected.value === name ? null : name
  }

  return { selected, onLegendClick, focusSeries, onMouseOver, onMouseOut, onClick, onBlankClick }
}
