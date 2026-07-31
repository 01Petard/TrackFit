import { bigint, boolean, datetime, decimal, index, int, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const appSettings = mysqlTable('app_settings', {
  id: int().primaryKey().default(1),
  heightCm: decimal('height_cm', { precision: 5, scale: 2 }),
  defaultDateRange: mysqlEnum('default_date_range', ['24h', '7d', '30d', '90d', 'all']).notNull().default('30d'),
  theme: mysqlEnum(['system', 'light', 'dark']).notNull().default('system'),
  dataVersion: int('data_version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
})

export const metricDefinitions = mysqlTable('metric_definition', {
  id: bigint({ mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  code: varchar({ length: 40 }).notNull(),
  name: varchar({ length: 40 }).notNull(),
  unit: varchar({ length: 12 }).notNull(),
  decimalPlaces: int('decimal_places').notNull().default(1),
  minimumValue: decimal('minimum_value', { precision: 12, scale: 3 }),
  maximumValue: decimal('maximum_value', { precision: 12, scale: 3 }),
  metricType: mysqlEnum('metric_type', ['core', 'custom']).notNull().default('custom'),
  enabled: boolean().notNull().default(true),
  sortOrder: int('sort_order').notNull().default(100),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, table => [
  uniqueIndex('uk_metric_definition_code').on(table.code),
  index('idx_metric_definition_enabled_sort').on(table.enabled, table.sortOrder),
])

export const measurementSessions = mysqlTable('measurement_session', {
  id: bigint({ mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  measuredAt: datetime('measured_at', { mode: 'date' }).notNull(),
  heightCmSnapshot: decimal('height_cm_snapshot', { precision: 5, scale: 2 }),
  note: varchar({ length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, table => [
  index('idx_measurement_session_measured_id').on(table.measuredAt, table.id),
])

export const measurementValues = mysqlTable('measurement_value', {
  id: bigint({ mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  sessionId: bigint('session_id', { mode: 'number', unsigned: true }).notNull().references(() => measurementSessions.id, { onDelete: 'cascade' }),
  metricId: bigint('metric_id', { mode: 'number', unsigned: true }).notNull().references(() => metricDefinitions.id, { onDelete: 'restrict' }),
  value: decimal({ precision: 12, scale: 3 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, table => [
  uniqueIndex('uk_measurement_value_session_metric').on(table.sessionId, table.metricId),
  index('idx_measurement_value_metric_session').on(table.metricId, table.sessionId),
])

