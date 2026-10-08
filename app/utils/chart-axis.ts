export const chartTimeAxis = {
  type: 'time' as const,
  maxInterval: 24 * 60 * 60 * 1000,
  axisLabel: {
    color: '#94a3b8',
    hideOverlap: true,
    margin: 12,
    formatter: {
      year: '{yyyy}\n{MM}-{dd}',
      month: '{MM}-{dd}',
      day: '{MM}-{dd}',
      hour: '{MM}-{dd}\n{HH}:{mm}',
      minute: '{MM}-{dd}\n{HH}:{mm}',
      second: '{MM}-{dd}\n{HH}:{mm}:{ss}',
      millisecond: '{MM}-{dd}\n{HH}:{mm}:{ss}',
    },
  },
  axisLine: { lineStyle: { color: '#cbd5e1' } },
}
