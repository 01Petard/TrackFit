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

export const backupSessionSchema = z.object({
  id: z.number().int().positive(),
  measuredAt: z.string().datetime(),
  heightCmSnapshot: z.number().nullable(),
  note: z.string().max(500).nullable(),
})

export const backupValueSchema = z.object({
  id: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  metricId: z.number().int().positive(),
  value: z.number(),
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
  version: z.literal(4),
  exportedAt: z.string().datetime(),
  settings: z.array(backupSettingsSchema).max(1),
  metrics: z.array(backupMetricSchema),
  sessions: z.array(backupSessionSchema),
  values: z.array(backupValueSchema),
  trainingSessions: z.array(backupTrainingSchema).default([]),
  sleepRecords: z.array(backupSleepSchema).default([]),
}).superRefine((data, context) => {
  if (data.settings[0] && data.settings[0].id !== 1) {
    context.addIssue({ code: 'custom', path: ['settings', 0, 'id'], message: '设置 ID 必须为 1' })
  }
  validateUnique(data.metrics.map(item => item.id), ['metrics'], '指标 ID 重复', context)
  validateUnique(data.metrics.map(item => item.code), ['metrics'], '指标编码重复', context)
  validateUnique(data.sessions.map(item => item.id), ['sessions'], '测量记录 ID 重复', context)
  validateUnique(data.values.map(item => item.id), ['values'], '测量值 ID 重复', context)
  validateUnique(data.trainingSessions.map(item => item.id), ['trainingSessions'], '训练记录 ID 重复', context)
  validateUnique(data.sleepRecords.map(item => item.id), ['sleepRecords'], '睡眠记录 ID 重复', context)

  const metricIds = new Set(data.metrics.map(item => item.id))
  const sessionIds = new Set(data.sessions.map(item => item.id))
  const pairs = new Set<string>()
  for (const [index, value] of data.values.entries()) {
    if (!metricIds.has(value.metricId)) {
      context.addIssue({ code: 'custom', path: ['values', index, 'metricId'], message: '指标不存在' })
    }
    if (!sessionIds.has(value.sessionId)) {
      context.addIssue({ code: 'custom', path: ['values', index, 'sessionId'], message: '测量记录不存在' })
    }
    const pair = `${value.sessionId}:${value.metricId}`
    if (pairs.has(pair)) {
      context.addIssue({ code: 'custom', path: ['values', index], message: '同一记录的指标不能重复' })
    }
    pairs.add(pair)
  }
})

export const backupSchema = z.preprocess(migrateLegacyBackup, currentBackupSchema)

function migrateLegacyBackup(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const data = input as Record<string, unknown>
  if (data.version !== 1 && data.version !== 2 && data.version !== 3) return input
  const trainingSessions = Array.isArray(data.trainingSessions)
    ? data.trainingSessions.map((item) => {
        if (!item || typeof item !== 'object') return item
        const { startedAt, intensity: _intensity, ...training } = item as Record<string, unknown>
        return { ...training, recordedAt: startedAt }
      })
    : []
  const sleepRecords = Array.isArray(data.sleepRecords)
    ? data.sleepRecords.map(item => (data.version === 1 || data.version === 2) && item && typeof item === 'object'
        ? { ...item, quality: Number((item as Record<string, unknown>).quality) * 20 }
        : item)
    : []
  return { ...data, version: 4, trainingSessions, sleepRecords }
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
