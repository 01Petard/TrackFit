import type { AnalyticsPointDto, AnalyticsSummaryDto, MovingAveragePeriod, MovingAveragePointDto } from '../types/api'
import { movingAveragePeriods } from '../types/api'

export interface RawAnalyticsPoint {
  id: number
  measuredAt: Date | string
  value: number
}

export function buildAnalytics(points: RawAnalyticsPoint[]): {
  points: AnalyticsPointDto[]
  movingAverages: Record<MovingAveragePeriod, MovingAveragePointDto[]>
  summary: AnalyticsSummaryDto | null
} {
  const ordered = [...points].sort((a, b) => {
    const timeDiff = new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    return timeDiff || a.id - b.id
  })
  const result = ordered.map(point => ({
    id: point.id,
    measuredAt: new Date(point.measuredAt).toISOString(),
    value: point.value,
  }))
  const movingAverages = buildDailyMovingAverages(ordered)
  if (!result.length) return { points: [], movingAverages, summary: null }

  const values = result.map(point => point.value)
  const first = values[0]!
  const latest = values.at(-1)!
  const previous = values.at(-2)
  return {
    points: result,
    movingAverages,
    summary: {
      first,
      latest,
      previousChange: previous == null ? null : round(latest - previous, 3),
      totalChange: round(latest - first, 3),
      minimum: Math.min(...values),
      maximum: Math.max(...values),
      average: round(values.reduce((sum, value) => sum + value, 0) / values.length, 3),
      count: values.length,
    },
  }
}

function buildDailyMovingAverages(points: RawAnalyticsPoint[]): Record<MovingAveragePeriod, MovingAveragePointDto[]> {
  const days = new Map<string, { sum: number, count: number, measuredAt: string }>()
  for (const point of points) {
    const date = new Date(point.measuredAt)
    const dayKey = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
    const current = days.get(dayKey)
    days.set(dayKey, {
      sum: (current?.sum ?? 0) + point.value,
      count: (current?.count ?? 0) + 1,
      measuredAt: date.toISOString(),
    })
  }
  const dailyValues = [...days.values()].map(day => ({ measuredAt: day.measuredAt, value: day.sum / day.count }))
  return Object.fromEntries(movingAveragePeriods.map(period => [
    period,
    dailyValues.flatMap((day, index) => {
      if (index + 1 < period) return []
      const window = dailyValues.slice(index + 1 - period, index + 1)
      return [{ measuredAt: day.measuredAt, value: round(window.reduce((sum, item) => sum + item.value, 0) / period, 3) }]
    }),
  ])) as Record<MovingAveragePeriod, MovingAveragePointDto[]>
}

export function calculateBmi(weight: number | undefined, heightCm: number | null): number | null {
  if (weight == null || heightCm == null || heightCm <= 0) return null
  return round(weight / ((heightCm / 100) ** 2), 2)
}

export function calculateWaistHipRatio(waist: number | undefined, hip: number | undefined): number | null {
  if (waist == null || hip == null || hip <= 0) return null
  return round(waist / hip, 3)
}

export function resolveYAxisBounds(
  metricCode: string,
  points: Array<{ value: number }>,
  targetMinimum?: number | null,
  targetMaximum?: number | null,
): { min?: number, max?: number } {
  if (metricCode !== 'weight') return {}
  if (targetMinimum != null && targetMaximum != null) return { min: targetMinimum, max: targetMaximum }
  const values = points.map(point => point.value)
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : {}
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces
  return Math.round((value + Number.EPSILON) * factor) / factor
}
