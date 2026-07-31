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
  movingAverage: number | null
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
  summary: AnalyticsSummaryDto | null
}

export interface AppSettingsDto {
  heightCm: number | null
  defaultDateRange: '24h' | '7d' | '30d' | '90d' | 'all'
  theme: 'system' | 'light' | 'dark'
  dataVersion: number
}

