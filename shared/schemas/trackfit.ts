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

export const settingsUpdateSchema = z.object({
  heightCm: z.number().min(80).max(250),
  defaultDateRange: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
})

export const backupSettingsSchema = z.object({
  id: z.number().int().positive(),
  heightCm: z.number().min(80).max(250).nullable(),
  defaultDateRange: z.enum(['24h', '7d', '30d', '90d', 'all']),
  theme: z.enum(['system', 'light', 'dark']),
  dataVersion: z.number().int().positive(),
})

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

export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  settings: z.array(backupSettingsSchema).max(1),
  metrics: z.array(backupMetricSchema),
  sessions: z.array(backupSessionSchema),
  values: z.array(backupValueSchema),
}).superRefine((data, context) => {
  if (data.settings[0] && data.settings[0].id !== 1) {
    context.addIssue({ code: 'custom', path: ['settings', 0, 'id'], message: '设置 ID 必须为 1' })
  }
  validateUnique(data.metrics.map(item => item.id), ['metrics'], '指标 ID 重复', context)
  validateUnique(data.metrics.map(item => item.code), ['metrics'], '指标编码重复', context)
  validateUnique(data.sessions.map(item => item.id), ['sessions'], '测量记录 ID 重复', context)
  validateUnique(data.values.map(item => item.id), ['values'], '测量值 ID 重复', context)

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
export type TrackFitData = z.infer<typeof backupSchema>
