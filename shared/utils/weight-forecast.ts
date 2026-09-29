import type { AnalyticsDto, MovingAveragePeriod } from '../types/api'
import { movingAveragePeriods } from '../types/api'

const dayMs = 24 * 60 * 60 * 1000

export interface WeightProjection {
  period: MovingAveragePeriod
  value: number | null
  direction: 'up' | 'down' | 'stable' | null
}

export interface WeightFluctuation {
  latest: number
  previous: number
  lower: number
  upper: number
  changePercent: number
  status: 'stable' | 'normal' | 'warning'
}

export function analyzeWeightForecast(analytics: AnalyticsDto | null, now = new Date()): {
  forecastDate: string | null
  stale: boolean
  projections: WeightProjection[]
  fluctuation: WeightFluctuation | null
} {
  const points = analytics?.points ?? []
  const latest = points.at(-1)
  const previous = points.at(-2)
  const fluctuation = latest && previous && previous.value > 0
    ? {
        latest: latest.value,
        previous: previous.value,
        lower: Math.round(previous.value * 0.99 * 100) / 100,
        upper: Math.round(previous.value * 1.01 * 100) / 100,
        changePercent: Math.round((latest.value / previous.value - 1) * 10000) / 100,
        status: Math.abs(latest.value - previous.value) <= previous.value * 0.005
          ? 'stable' as const
          : Math.abs(latest.value - previous.value) <= previous.value * 0.01 ? 'normal' as const : 'warning' as const,
      }
    : null

  const latestTime = latest ? Date.parse(latest.measuredAt) : NaN
  const stale = Number.isFinite(latestTime) && now.getTime() - latestTime > 7 * dayMs
  const forecastDate = latest && !stale ? new Date(latestTime + 7 * dayMs).toISOString() : null
  const projections = movingAveragePeriods.map((period): WeightProjection => {
    const averages = analytics?.movingAverages[period] ?? []
    const last = averages.at(-1)
    if (!last || stale || !forecastDate) return { period, value: null, direction: null }
    const lastTime = Date.parse(last.measuredAt)
    const first = averages.find(point => Date.parse(point.measuredAt) >= lastTime - 7 * dayMs)
    const elapsedDays = first ? (lastTime - Date.parse(first.measuredAt)) / dayMs : 0
    if (!first || elapsedDays <= 0) return { period, value: null, direction: null }

    const estimate = last.value + (last.value - first.value) / elapsedDays * 7
    if (!Number.isFinite(estimate) || estimate <= 0) return { period, value: null, direction: null }
    const changeRatio = (estimate - last.value) / last.value
    return {
      period,
      value: Math.round(estimate * 100) / 100,
      direction: changeRatio > 0.002 ? 'up' : changeRatio < -0.002 ? 'down' : 'stable',
    }
  })

  return { forecastDate, stale, projections, fluctuation }
}
