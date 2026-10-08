import dayjs from 'dayjs'

export function toDailyChartPoints(points: ReadonlyArray<{ measuredAt: string, value: number }>): Array<[number, number]> {
  return points.map(point => [dayjs(point.measuredAt).startOf('day').valueOf(), point.value])
}

export const chartTimeAxis = {
  type: 'time' as const,
  minInterval: 24 * 60 * 60 * 1000,
  maxInterval: 24 * 60 * 60 * 1000,
  axisPointer: {
    snap: true,
    label: { formatter: (params: { value: string | number }) => dayjs(params.value).format('MM-DD') },
  },
  axisLabel: {
    color: '#94a3b8',
    hideOverlap: true,
    showMinLabel: true,
    showMaxLabel: true,
    margin: 12,
    formatter: {
      year: '{yyyy}\n{MM}-{dd}',
      month: '{MM}-{dd}',
      day: '{MM}-{dd}',
      hour: '{MM}-{dd}',
      minute: '{MM}-{dd}',
      second: '{MM}-{dd}',
      millisecond: '{MM}-{dd}',
    },
  },
  axisLine: { lineStyle: { color: '#cbd5e1' } },
}
