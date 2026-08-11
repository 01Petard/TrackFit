import type { TrackFitData } from '../../shared/schemas/trackfit'
import { describe, expect, it } from 'vitest'
import { deleteMeasurement } from '../../shared/utils/trackfit'

describe('领域错误', () => {
  it('使用稳定错误码而不是界面语言描述业务失败', () => {
    const data: TrackFitData = {
      version: 6,
      exportedAt: '2026-08-01T00:00:00.000Z',
      settings: [],
      metrics: [],
      bodyRecords: [],
      trainingRecords: [],
      sleepRecords: [],
    }

    expect(() => deleteMeasurement(data, 999)).toThrowError(
      expect.objectContaining({ code: 'measurement.notFound' }),
    )
  })
})
