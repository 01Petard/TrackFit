import type { TrackFitData } from '../../shared/schemas/trackfit'
import { describe, expect, it } from 'vitest'
import { backupSchema } from '../../shared/schemas/trackfit'
import { createMetric, deleteMeasurement, getAnalytics, listMeasurements, saveMeasurement, saveSettings } from '../../shared/utils/trackfit'

describe('前端数据业务', () => {
  it('新增测量记录并完成分页、筛选和分析', () => {
    const data = fixture()
    const id = saveMeasurement(data, {
      measuredAt: '2026-08-01T08:00:00.000Z',
      note: '晨起',
      values: [{ metricId: 1, value: 70.126 }],
    })

    expect(id).toBe(1)
    expect(data.bodyRecords[0]?.values[0]?.value).toBe(70.13)
    expect(listMeasurements(data, { page: 1, pageSize: 20, metricId: 1 }).items[0]).toMatchObject({
      id: 1,
      note: '晨起',
      bmi: 22.9,
    })
    expect(getAnalytics(data, 'weight')?.summary?.latest).toBe(70.13)
  })

  it('设置身高变化后统一重新计算历史 BMI', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: '2026-08-01T08:00:00.000Z', values: [{ metricId: 1, value: 70 }] })
    expect(listMeasurements(data, { page: 1, pageSize: 20 }).items[0]?.bmi).toBe(22.86)

    data.settings[0]!.heightCm = 170
    expect(listMeasurements(data, { page: 1, pageSize: 20 }).items[0]?.bmi).toBe(24.22)
    expect(data.bodyRecords[0]).not.toHaveProperty('heightCmSnapshot')
  })

  it('删除记录时同步删除指标值', () => {
    const data = fixture()
    saveMeasurement(data, { measuredAt: '2026-08-01T08:00:00.000Z', values: [{ metricId: 1, value: 70 }] })
    deleteMeasurement(data, 1)
    expect(data.bodyRecords).toEqual([])
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
    expect(() => createMetric(data, { code: 'weight', name: '重复体重', unit: 'kg', decimalPlaces: 1, sortOrder: 100 })).toThrowError(
      expect.objectContaining({ code: 'metric.codeExists' }),
    )
    expect(() => saveMeasurement(data, { measuredAt: '2026-08-01T08:00:00.000Z', values: [{ metricId: 1, value: 500 }] })).toThrowError(
      expect.objectContaining({ code: 'metric.outOfRange', values: { metric: '体重' } }),
    )
  })

  it('拒绝引用不存在指标的备份数据', () => {
    const data = fixture()
    data.bodyRecords.push({ id: 1, measuredAt: '2026-08-01T08:00:00.000Z', note: null, values: [{ metricId: 99, value: 70 }] })
    expect(backupSchema.safeParse(data).success).toBe(false)
  })

  it('保存个人目标体重上下限并校验顺序', () => {
    const data = fixture()
    saveSettings(data, {
      heightCm: 175,
      desiredWeightMinimum: 60,
      desiredWeightMaximum: 75,
      defaultDateRange: '30d',
      theme: 'system',
    })
    expect(data.settings[0]).toMatchObject({ desiredWeightMinimum: 60, desiredWeightMaximum: 75 })
    expect(() => saveSettings(data, {
      heightCm: 175,
      desiredWeightMinimum: 80,
      desiredWeightMaximum: 75,
      defaultDateRange: '30d',
      theme: 'system',
    })).toThrow('目标体重下限必须小于上限')
  })

  it('区间分析沿用区间之前的日均值计算均线', () => {
    const data = fixture()
    for (let index = 0; index < 4; index++) {
      saveMeasurement(data, {
        measuredAt: new Date(Date.UTC(2026, 6, index + 1, 8)).toISOString(),
        values: [{ metricId: 1, value: 80 - index }],
      })
    }
    const analytics = getAnalytics(data, 'weight', '2026-07-04T00:00:00.000Z')
    expect(analytics?.points).toHaveLength(1)
    expect(analytics?.movingAverages[3]).toEqual([{ measuredAt: '2026-07-04T08:00:00.000Z', value: 78 }])
  })
})

function fixture(): TrackFitData {
  return {
    version: 6,
    exportedAt: '2026-08-01T00:00:00.000Z',
    settings: [{ id: 1, heightCm: 175, desiredWeightMinimum: null, desiredWeightMaximum: null, defaultDateRange: '30d', theme: 'system', dataVersion: 1 }],
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
    bodyRecords: [],
    trainingRecords: [],
    sleepRecords: [],
  }
}
