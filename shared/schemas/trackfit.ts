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

const backupSettingsSchema = z.object({
  id: z.number().int().positive(),
  heightCm: z.number().nullable(),
  defaultDateRange: z.enum(['24h', '7d', '30d', '90d', 'all']),
  theme: z.enum(['system', 'light', 'dark']),
  dataVersion: z.number().int().positive(),
})

const backupMetricSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  name: z.string(),
  unit: z.string(),
  decimalPlaces: z.number().int().min(0).max(3),
  minimumValue: z.number().nullable(),
  maximumValue: z.number().nullable(),
  metricType: z.enum(['core', 'custom']),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
})

const backupSessionSchema = z.object({
  id: z.number().int().positive(),
  measuredAt: z.string().datetime(),
  heightCmSnapshot: z.number().nullable(),
  note: z.string().nullable(),
})

const backupValueSchema = z.object({
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
})

export type MeasurementWrite = z.infer<typeof measurementWriteSchema>
export type MetricCreate = z.infer<typeof metricCreateSchema>
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>
