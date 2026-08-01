import type { AnalyticsPointDto, AnalyticsSummaryDto } from '../types/api'

export interface RawAnalyticsPoint {
  id: number
  measuredAt: Date | string
  value: number
}

export function buildAnalytics(points: RawAnalyticsPoint[]): {
  points: AnalyticsPointDto[]
  summary: AnalyticsSummaryDto | null
} {
  const ordered = [...points].sort((a, b) => {
    const timeDiff = new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    return timeDiff || a.id - b.id
  })
  const result = ordered.map((point, index) => {
    const window = ordered.slice(Math.max(0, index - 6), index + 1)
    const movingAverage = window.length === 7
      ? window.reduce((sum, item) => sum + item.value, 0) / window.length
      : null
    return {
      id: point.id,
      measuredAt: new Date(point.measuredAt).toISOString(),
      value: point.value,
      movingAverage: movingAverage == null ? null : round(movingAverage, 3),
    }
  })
  if (!result.length) return { points: [], summary: null }

  const values = result.map(point => point.value)
  const first = values[0]!
  const latest = values.at(-1)!
  const previous = values.at(-2)
  return {
    points: result,
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

export function calculateBmi(weight: number | undefined, heightCm: number | null): number | null {
  if (weight == null || heightCm == null || heightCm <= 0) return null
  return round(weight / ((heightCm / 100) ** 2), 2)
}

export function calculateWaistHipRatio(waist: number | undefined, hip: number | undefined): number | null {
  if (waist == null || hip == null || hip <= 0) return null
  return round(waist / hip, 3)
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces
  return Math.round((value + Number.EPSILON) * factor) / factor
}
