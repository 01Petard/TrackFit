import type { AnalyticsDto, AnalyticsPointDto, AnalyticsSummaryDto, MovingAveragePeriod, MovingAveragePointDto } from '../types/api'
import { movingAveragePeriods } from '../types/api'

export interface RawAnalyticsPoint {
  id: number
  measuredAt: Date | string
  value: number
}

export interface MetricTrendInsight {
  direction: 'up' | 'down' | 'stable' | 'insufficient'
  trend: LocalizedDescriptor
  change: LocalizedDescriptor
  evaluation: LocalizedDescriptor
  tone: 'positive' | 'warning' | 'neutral'
}

export interface LocalizedDescriptor {
  key: string
  values?: Record<string, string | number>
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

export function buildMetricTrendInsight(
  analytics: AnalyticsDto,
  targetMinimum?: number | null,
  targetMaximum?: number | null,
): MetricTrendInsight | null {
  const summary = analytics.summary
  if (!summary) return null
  if (summary.count < 2) {
    return {
      direction: 'insufficient',
      trend: message('insights.trend.accumulating'),
      change: message('insights.change.oneRecord'),
      evaluation: message('insights.evaluation.insufficient'),
      tone: 'neutral',
    }
  }

  const threshold = 10 ** -analytics.metric.decimalPlaces
  const direction = Math.abs(summary.totalChange) < threshold
    ? 'stable'
    : summary.totalChange > 0 ? 'up' : 'down'
  const change = direction === 'stable'
    ? message('insights.change.stable')
    : message(`insights.change.${direction}`, { amount: Math.abs(summary.totalChange), unit: analytics.metric.unit })

  if (analytics.metric.code === 'weight' && targetMinimum != null && targetMaximum != null) {
    if (summary.latest >= targetMinimum && summary.latest <= targetMaximum) {
      return { direction, trend: directionDescriptor(direction), change, evaluation: message('insights.evaluation.weightWithinTarget'), tone: 'positive' }
    }
    if (summary.latest > targetMaximum) {
      return direction === 'down'
        ? { direction, trend: message('insights.trend.approaching'), change, evaluation: message('insights.evaluation.weightAboveApproaching'), tone: 'positive' }
        : { direction, trend: directionDescriptor(direction), change, evaluation: message('insights.evaluation.weightAboveObserve'), tone: 'warning' }
    }
    return direction === 'up'
      ? { direction, trend: message('insights.trend.approaching'), change, evaluation: message('insights.evaluation.weightBelowApproaching'), tone: 'positive' }
      : { direction, trend: directionDescriptor(direction), change, evaluation: message('insights.evaluation.weightBelowObserve'), tone: 'warning' }
  }

  if (direction === 'stable') {
    return { direction, trend: message('insights.trend.stable'), change, evaluation: metricMessage('insights.evaluation.stable', analytics), tone: 'positive' }
  }
  if (analytics.metric.code === 'waist' || analytics.metric.code === 'body_fat') {
    return direction === 'down'
      ? { direction, trend: message('insights.trend.gentleDown'), change, evaluation: metricMessage('insights.evaluation.favorableDown', analytics), tone: 'positive' }
      : { direction, trend: message('insights.trend.increased'), change, evaluation: metricMessage('insights.evaluation.increasedObserve', analytics), tone: 'warning' }
  }
  return {
    direction,
    trend: directionDescriptor(direction),
    change,
    evaluation: metricMessage(`insights.evaluation.generic${direction === 'up' ? 'Up' : 'Down'}`, analytics),
    tone: 'neutral',
  }
}

function directionDescriptor(direction: MetricTrendInsight['direction']): LocalizedDescriptor {
  return message(`insights.trend.${direction}`)
}

function metricMessage(key: string, analytics: AnalyticsDto): LocalizedDescriptor {
  return message(key, { metricCode: analytics.metric.code, metricName: analytics.metric.name })
}

function message(key: string, values?: Record<string, string | number>): LocalizedDescriptor {
  return values ? { key, values } : { key }
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces
  return Math.round((value + Number.EPSILON) * factor) / factor
}
