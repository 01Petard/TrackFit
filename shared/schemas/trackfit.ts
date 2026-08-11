import { z } from 'zod'

export const metricValueSchema = z.object({
  metricId: z.number().int().positive(),
  value: z.number().finite(),
})

export const measurementWriteSchema = z.object({
  measuredAt: z.coerce.date(),
  note: z.string().trim().max(500).nullable().optional(),
  values: z.array(metricValueSchema).min(1, '至少填写一个身体指标'),
}).superRefine(({ values }, context) => {
  const metricIds = values.map(item => item.metricId)
  if (new Set(metricIds).size !== metricIds.length) {
    context.addIssue({
      code: 'custom',
      path: ['values'],
      message: '同一指标不能重复填写',
    })
  }
})

export const trainingTypes = ['strength', 'cardio', 'mobility', 'other'] as const
export const trainingWriteTypes = ['strength', 'cardio', 'mobility'] as const

export const trainingWriteSchema = z.object({
  type: z.enum(trainingWriteTypes),
  durationMinutes: z.number().int().min(1).max(1440),
  note: z.string().trim().max(500).nullable().optional(),
})

export const sleepWriteSchema = z.object({
  fellAsleepAt: z.coerce.date(),
  durationMinutes: z.number().int().min(1).max(1440),
  quality: z.number().int().min(1).max(100),
})

const metricBaseSchema = z.object({
  name: z.string().trim().min(1).max(40),
  code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,39}$/),
  unit: z.string().trim().min(1).max(12),
  decimalPlaces: z.number().int().min(0).max(3).default(1),
  minimumValue: z.number().finite().nullable().optional(),
  maximumValue: z.number().finite().nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(100),
})

export const metricCreateSchema = metricBaseSchema.refine(
  value => value.minimumValue == null || value.maximumValue == null || value.minimumValue < value.maximumValue,
  { message: '最小值必须小于最大值', path: ['minimumValue'] },
)

export const metricUpdateSchema = metricBaseSchema.partial().extend({
  enabled: z.boolean().optional(),
}).refine(
  value => value.minimumValue == null || value.maximumValue == null || value.minimumValue < value.maximumValue,
  { message: '最小值必须小于最大值', path: ['minimumValue'] },
)

const settingsBaseSchema = z.object({
  heightCm: z.number().min(80).max(250),
  desiredWeightMinimum: z.number().min(20).max(400).nullable().default(null),
  desiredWeightMaximum: z.number().min(20).max(400).nullable().default(null),
  defaultDateRange: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
  sleepGoalHours: z.number().min(1).max(16).default(8),
  weeklyTrainingGoalMinutes: z.number().int().min(0).max(10080).default(150),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
})

function validateDesiredWeightRange(
  value: { desiredWeightMinimum: number | null, desiredWeightMaximum: number | null },
  context: z.RefinementCtx,
) {
  if ((value.desiredWeightMinimum == null) !== (value.desiredWeightMaximum == null)) {
    context.addIssue({ code: 'custom', path: ['desiredWeightMinimum'], message: '目标体重上下限必须同时填写' })
  } else if (value.desiredWeightMinimum != null && value.desiredWeightMaximum != null && value.desiredWeightMinimum >= value.desiredWeightMaximum) {
    context.addIssue({ code: 'custom', path: ['desiredWeightMinimum'], message: '目标体重下限必须小于上限' })
  }
}

export const settingsUpdateSchema = settingsBaseSchema.superRefine(validateDesiredWeightRange)

export const backupSettingsSchema = settingsBaseSchema.extend({
  id: z.number().int().positive(),
  heightCm: z.number().min(80).max(250).nullable(),
  dataVersion: z.number().int().positive(),
}).superRefine(validateDesiredWeightRange)

export const backupMetricSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  name: z.string().min(1).max(40),
  unit: z.string().min(1).max(12),
  decimalPlaces: z.number().int().min(0).max(3),
  minimumValue: z.number().nullable(),
  maximumValue: z.number().nullable(),
  metricType: z.enum(['core', 'custom']),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
}).refine(
  value => value.minimumValue == null || value.maximumValue == null || value.minimumValue < value.maximumValue,
  { message: '最小值必须小于最大值', path: ['minimumValue'] },
)

export const backupBodyRecordValueSchema = z.object({
  metricId: z.number().int().positive(),
  value: z.number(),
})

export const backupBodyRecordSchema = z.object({
  id: z.number().int().positive(),
  measuredAt: z.string().datetime(),
  note: z.string().max(500).nullable(),
  values: z.array(backupBodyRecordValueSchema).min(1),
})

export const backupTrainingSchema = z.object({
  id: z.number().int().positive(),
  recordedAt: z.string().datetime(),
  type: z.enum(trainingTypes),
  durationMinutes: z.number().int().min(1).max(1440),
  note: z.string().max(500).nullable(),
})

export const backupSleepSchema = z.object({
  id: z.number().int().positive(),
  fellAsleepAt: z.string().datetime(),
  wokeUpAt: z.string().datetime(),
  quality: z.number().int().min(1).max(100),
  note: z.string().max(500).nullable(),
}).superRefine(({ fellAsleepAt, wokeUpAt }, context) => {
  const duration = new Date(wokeUpAt).getTime() - new Date(fellAsleepAt).getTime()
  if (duration <= 0 || duration > 24 * 60 * 60 * 1000) {
    context.addIssue({ code: 'custom', path: ['wokeUpAt'], message: '睡眠时间范围无效' })
  }
})

const currentBackupSchema = z.object({
  version: z.literal(6),
  exportedAt: z.string().datetime(),
  settings: z.array(backupSettingsSchema).max(1),
  metrics: z.array(backupMetricSchema),
  bodyRecords: z.array(backupBodyRecordSchema),
  trainingRecords: z.array(backupTrainingSchema).default([]),
  sleepRecords: z.array(backupSleepSchema).default([]),
}).superRefine((data, context) => {
  if (data.settings[0] && data.settings[0].id !== 1) {
    context.addIssue({ code: 'custom', path: ['settings', 0, 'id'], message: '设置 ID 必须为 1' })
  }
  validateUnique(data.metrics.map(item => item.id), ['metrics'], '指标 ID 重复', context)
  validateUnique(data.metrics.map(item => item.code), ['metrics'], '指标编码重复', context)
  validateUnique(data.bodyRecords.map(item => item.id), ['bodyRecords'], '身体记录 ID 重复', context)
  validateUnique(data.trainingRecords.map(item => item.id), ['trainingRecords'], '训练记录 ID 重复', context)
  validateUnique(data.sleepRecords.map(item => item.id), ['sleepRecords'], '睡眠记录 ID 重复', context)

  const metricIds = new Set(data.metrics.map(item => item.id))
  for (const [recordIndex, record] of data.bodyRecords.entries()) {
    const recordMetricIds = record.values.map(value => value.metricId)
    validateUnique(recordMetricIds, ['bodyRecords', recordIndex, 'values'], '同一记录的指标不能重复', context)
    for (const [valueIndex, value] of record.values.entries()) {
      if (!metricIds.has(value.metricId)) {
        context.addIssue({ code: 'custom', path: ['bodyRecords', recordIndex, 'values', valueIndex, 'metricId'], message: '指标不存在' })
      }
    }
  }
})

export const backupSchema = z.preprocess(migrateLegacyBackup, currentBackupSchema)

function migrateLegacyBackup(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const data = input as Record<string, unknown>
  if (data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4 && data.version !== 5) return input
  const sessions = Array.isArray(data.sessions)
    ? data.sessions.map((item) => {
        if (!item || typeof item !== 'object') return item
        const { heightCmSnapshot: _heightCmSnapshot, ...session } = item as Record<string, unknown>
        return session
      })
    : []
  const values = Array.isArray(data.values) ? data.values : []
  const sessionIds = new Set(sessions.flatMap(item => item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'number' ? [(item as Record<string, unknown>).id] : []))
  if (values.some(item => item && typeof item === 'object' && !sessionIds.has((item as Record<string, unknown>).sessionId))) return input
  const bodyRecords = sessions.map((item) => {
    if (!item || typeof item !== 'object') return item
    const session = item as Record<string, unknown>
    return {
      ...session,
      values: values.flatMap((value) => {
        if (!value || typeof value !== 'object') return []
        const legacyValue = value as Record<string, unknown>
        return legacyValue.sessionId === session.id ? [{ metricId: legacyValue.metricId, value: legacyValue.value }] : []
      }),
    }
  })
  const trainingSessions = Array.isArray(data.trainingSessions)
    ? data.trainingSessions.map((item) => {
        if (!item || typeof item !== 'object') return item
        const { startedAt, intensity: _intensity, ...training } = item as Record<string, unknown>
        return 'recordedAt' in training ? training : { ...training, recordedAt: startedAt }
      })
    : []
  const sleepRecords = Array.isArray(data.sleepRecords)
    ? data.sleepRecords.map(item => (data.version === 1 || data.version === 2) && item && typeof item === 'object'
        ? { ...item, quality: Number((item as Record<string, unknown>).quality) * 20 }
        : item)
    : []
  return { ...data, version: 6, bodyRecords, trainingRecords: trainingSessions, sleepRecords }
}

function validateUnique(
  values: Array<number | string>,
  path: Array<string | number>,
  message: string,
  context: z.RefinementCtx,
) {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: 'custom', path, message })
  }
}

export type MeasurementWrite = z.infer<typeof measurementWriteSchema>
export type MetricCreate = z.infer<typeof metricCreateSchema>
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>
export type TrainingWrite = z.infer<typeof trainingWriteSchema>
export type SleepWrite = z.infer<typeof sleepWriteSchema>
export type TrackFitData = z.infer<typeof backupSchema>
