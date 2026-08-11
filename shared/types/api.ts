export interface MetricDefinitionDto {
  id: number
  code: string
  name: string
  unit: string
  decimalPlaces: number
  minimumValue: number | null
  maximumValue: number | null
  metricType: 'core' | 'custom'
  enabled: boolean
  sortOrder: number
}

export interface MeasurementValueDto {
  metricId: number
  code: string
  name: string
  unit: string
  value: number
}

export interface MeasurementDto {
  id: number
  measuredAt: string
  heightCmSnapshot: number | null
  note: string | null
  bmi: number | null
  waistHipRatio: number | null
  values: MeasurementValueDto[]
}

export interface MeasurementPageDto {
  items: MeasurementDto[]
  total: number
  page: number
  pageSize: number
}

export interface AnalyticsPointDto {
  id: number
  measuredAt: string
  value: number
}

export const movingAveragePeriods = [3, 7, 30, 90] as const

export type MovingAveragePeriod = typeof movingAveragePeriods[number]

export interface MovingAveragePointDto {
  measuredAt: string
  value: number
}

export interface AnalyticsSummaryDto {
  first: number
  latest: number
  previousChange: number | null
  totalChange: number
  minimum: number
  maximum: number
  average: number
  count: number
}

export interface AnalyticsDto {
  metric: MetricDefinitionDto
  points: AnalyticsPointDto[]
  movingAverages: Record<MovingAveragePeriod, MovingAveragePointDto[]>
  summary: AnalyticsSummaryDto | null
}

export interface AppSettingsDto {
  heightCm: number | null
  desiredWeightMinimum: number | null
  desiredWeightMaximum: number | null
  defaultDateRange: '24h' | '7d' | '30d' | '90d' | 'all'
  sleepGoalHours: number
  weeklyTrainingGoalMinutes: number
  theme: 'system' | 'light' | 'dark'
  dataVersion: number
}

export type TrainingType = 'strength' | 'cardio' | 'mobility' | 'other'

export interface TrainingSessionDto {
  id: number
  recordedAt: string
  type: TrainingType
  durationMinutes: number
  note: string | null
}

export interface SleepRecordDto {
  id: number
  fellAsleepAt: string
  wokeUpAt: string
  durationMinutes: number
  quality: number
  note: string | null
}

export interface BehaviorQuery {
  start?: string
  end?: string
}

export interface BehaviorTimelineItemDto {
  id: number
  kind: 'training' | 'sleep'
  occurredAt: string
  training?: TrainingSessionDto
  sleep?: SleepRecordDto
}

export interface CorrelationDto {
  metricCode: string
  metricName: string
  factor: 'trainingDuration' | 'sleepDuration' | 'sleepQuality'
  lagDays: 0 | 1 | 3 | 7
  coefficient: number
  sampleSize: number
}

export interface PeriodReportDto {
  period: 'week' | 'month'
  start: string
  end: string
  bodyMetrics: Array<{
    code: string
    name: string
    unit: string
    average: number | null
    change: number | null
    volatility: number | null
    previousAverage: number | null
  }>
  training: {
    count: number
    totalMinutes: number
    previousTotalMinutes: number
  }
  sleep: {
    averageMinutes: number | null
    averageQuality: number | null
    goalDays: number
    previousAverageMinutes: number | null
  }
  strongestCorrelations: CorrelationDto[]
}
