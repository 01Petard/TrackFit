import type { TrackFitData } from '../../shared/schemas/trackfit'
import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import { createMetric, deleteMeasurement, getAnalytics, listMeasurements, saveMeasurement } from '../../shared/utils/trackfit'

describe('前端数据业务', () => {
  it('新增测量记录并完成分页、筛选和分析', () => {
    const data = fixture()
    const id = saveMeasurement(data, {
      measuredAt: '2026-08-01T08:00:00.000Z',
      note: '晨起',
      values: [{ metricId: 1, value: 70.126 }],
    })

    expect(id).toBe(1)
    expect(data.values[0]?.value).toBe(70.13)
    expect(listMeasurements(data, { page: 1, pageSize: 20, metricId: 1 }).items[0]).toMatchObject({
      id: 1,
      note: '晨起',
      bmi: 22.9,
    })
    expect(getAnalytics(data, 'weight')?.summary?.latest).toBe(70.13)
  })

  it('删除记录时同步删除指标值', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: '2026-08-01T08:00:00.000Z', values: [{ metricId: 1, value: 70 }] })
    deleteMeasurement(data, 1)
    expect(data.sessions).toEqual([])
    expect(data.values).toEqual([])
  })

  it('按指标返回最近一次有效值，不受最新记录缺少该指标影响', () => {
    const data = fixture()
    data.metrics.push({
      id: 2,
      code: 'body_fat',
      name: '体脂率',
      unit: '%',
      decimalPlaces: 1,
      minimumValue: 1,
      maximumValue: 75,
      metricType: 'core',
      enabled: true,
      sortOrder: 20,
    })
    saveMeasurement(data, { measuredAt: '2026-07-01T08:00:00.000Z', values: [{ metricId: 2, value: 26 }] })
    saveMeasurement(data, { measuredAt: '2026-08-01T08:00:00.000Z', values: [{ metricId: 1, value: 70 }] })

    expect(listMeasurements(data, { page: 1, pageSize: 1 }).items[0]?.values).toHaveLength(1)
    expect(getAnalytics(data, 'body_fat')?.summary?.latest).toBe(26)
  })

  it('拒绝重复指标编码和越界测量值', () => {
    const data = fixture()
    expect(() => createMetric(data, { code: 'weight', name: '重复体重', unit: 'kg', decimalPlaces: 1, sortOrder: 100 })).toThrow('指标编码已存在')
    expect(() => saveMeasurement(data, { measuredAt: '2026-08-01T08:00:00.000Z', values: [{ metricId: 1, value: 500 }] })).toThrow('体重 超出合理范围')
  })

  it('拒绝引用不存在记录的备份数据', () => {
    const data = fixture()
    data.values.push({ id: 1, sessionId: 99, metricId: 1, value: 70 })
    expect(backupSchema.safeParse(data).success).toBe(false)
  })
})

function fixture(): TrackFitData {
  return {
    version: 1,
    exportedAt: '2026-08-01T00:00:00.000Z',
    settings: [{ id: 1, heightCm: 175, defaultDateRange: '30d', theme: 'system', dataVersion: 1 }],
    metrics: [{
      id: 1,
      code: 'weight',
      name: '体重',
      unit: 'kg',
      decimalPlaces: 2,
      minimumValue: 20,
      maximumValue: 400,
      metricType: 'core',
      enabled: true,
      sortOrder: 10,
    }],
    sessions: [],
    values: [],
  }
}
