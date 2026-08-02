import type { AnalyticsDto, AnalyticsPointDto, AnalyticsSummaryDto, MovingAveragePeriod, MovingAveragePointDto } from '../types/api'
import { movingAveragePeriods } from '../types/api'

export interface RawAnalyticsPoint {
  id: number
  measuredAt: Date | string
  value: number
}

export interface MetricTrendInsight {
  direction: 'up' | 'down' | 'stable' | 'insufficient'
  trendLabel: string
  changeLabel: string
  evaluation: string
  tone: 'positive' | 'warning' | 'neutral'
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
      trendLabel: '数据积累中',
      changeLabel: '仅 1 次记录',
      evaluation: '本周记录还比较少，再记录一次后就能判断变化趋势',
      tone: 'neutral',
    }
  }

  const threshold = 10 ** -analytics.metric.decimalPlaces
  const direction = Math.abs(summary.totalChange) < threshold
    ? 'stable'
    : summary.totalChange > 0 ? 'up' : 'down'
  const changeLabel = direction === 'stable'
    ? '变化不明显'
    : `${direction === 'up' ? '上升' : '下降'} ${Math.abs(summary.totalChange)} ${analytics.metric.unit}`

  if (analytics.metric.code === 'weight' && targetMinimum != null && targetMaximum != null) {
    if (summary.latest >= targetMinimum && summary.latest <= targetMaximum) {
      return { direction, trendLabel: directionLabel(direction), changeLabel, evaluation: '当前体重处于个人目标区间，保持稳定节奏即可', tone: 'positive' }
    }
    if (summary.latest > targetMaximum) {
      return direction === 'down'
        ? { direction, trendLabel: '向目标靠近', changeLabel, evaluation: '体重仍高于目标上限，但过去 7 天正在向目标区间靠近', tone: 'positive' }
        : { direction, trendLabel: directionLabel(direction), changeLabel, evaluation: '体重仍高于目标上限，建议继续观察饮食、活动和测量条件', tone: 'warning' }
    }
    return direction === 'up'
      ? { direction, trendLabel: '向目标靠近', changeLabel, evaluation: '体重低于目标下限，但过去 7 天正在向目标区间靠近', tone: 'positive' }
      : { direction, trendLabel: directionLabel(direction), changeLabel, evaluation: '体重低于目标下限，建议关注近期状态并保持规律记录', tone: 'warning' }
  }

  if (direction === 'stable') {
    return { direction, trendLabel: '整体平稳', changeLabel, evaluation: `${analytics.metric.name}过去 7 天波动较小，整体比较稳定`, tone: 'positive' }
  }
  if (analytics.metric.code === 'waist' || analytics.metric.code === 'body_fat') {
    return direction === 'down'
      ? { direction, trendLabel: '温和下降', changeLabel, evaluation: `${analytics.metric.name}呈下降趋势，变化方向积极，建议继续保持规律记录`, tone: 'positive' }
      : { direction, trendLabel: '有所上升', changeLabel, evaluation: `${analytics.metric.name}有所上升，先结合测量时间和状态持续观察`, tone: 'warning' }
  }
  return {
    direction,
    trendLabel: directionLabel(direction),
    changeLabel,
    evaluation: `${analytics.metric.name}过去 7 天${direction === 'up' ? '有所上升' : '有所下降'}，建议结合个人目标持续观察`,
    tone: 'neutral',
  }
}

function directionLabel(direction: MetricTrendInsight['direction']): string {
  if (direction === 'up') return '呈上升趋势'
  if (direction === 'down') return '呈下降趋势'
  if (direction === 'stable') return '整体平稳'
  return '数据积累中'
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces
  return Math.round((value + Number.EPSILON) * factor) / factor
}
