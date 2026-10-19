import type { TrackFitData } from '../schemas/trackfit'
import type { AppSettingsDto } from '../types/api'
import dayjs from 'dayjs'
import { getSettings } from './trackfit'

export function buildRecordOverview(data: {
  settings: readonly AppSettingsDto[]
  bodyRecords: ReadonlyArray<Pick<TrackFitData['bodyRecords'][number], 'measuredAt'>>
  trainingRecords: ReadonlyArray<TrackFitData['trainingRecords'][number]>
  sleepRecords: ReadonlyArray<TrackFitData['sleepRecords'][number]>
}, now = new Date()) {
  const settings = getSettings(data)
  const percent = (value: number, goal: number) => Math.min(100, Math.max(0, goal > 0 ? Math.round(value / goal * 100) : value > 0 ? 100 : 0))
  const today = dayjs(now).startOf('day')
  const buckets = new Map<string, { date: string, bodyCount: number, trainingCount: number, trainingMinutes: number, sleepCount: number, sleepMinutes: number }>()
  const firstDay = today.subtract(27, 'day')
  for (let index = 0; index < 28; index++) {
    const date = firstDay.add(index, 'day').format('YYYY-MM-DD')
    buckets.set(date, { date, bodyCount: 0, trainingCount: 0, trainingMinutes: 0, sleepCount: 0, sleepMinutes: 0 })
  }
  for (const record of data.bodyRecords) {
    const day = buckets.get(dayjs(record.measuredAt).format('YYYY-MM-DD'))
    if (day && new Date(record.measuredAt) <= now) day.bodyCount++
  }
  for (const record of data.trainingRecords) {
    const day = buckets.get(dayjs(record.recordedAt).format('YYYY-MM-DD'))
    if (day && new Date(record.recordedAt) <= now) {
      day.trainingCount++
      day.trainingMinutes += record.durationMinutes
    }
  }
  for (const record of data.sleepRecords) {
    const day = buckets.get(dayjs(record.wokeUpAt).format('YYYY-MM-DD'))
    if (day && new Date(record.wokeUpAt) <= now) {
      day.sleepCount++
      day.sleepMinutes += (new Date(record.wokeUpAt).getTime() - new Date(record.fellAsleepAt).getTime()) / 60_000
    }
  }
  const days = [...buckets.values()]
  const dailyTrainingGoal = settings.weeklyTrainingGoalMinutes / settings.weeklyTrainingGoalCount
  const heatmap = days.map(day => ({
    ...day,
    body: day.bodyCount ? 100 : 0,
    training: percent(day.trainingMinutes, dailyTrainingGoal),
    sleep: percent(day.sleepMinutes, settings.sleepGoalHours * 60),
  }))
  const coverage = (['body', 'training', 'sleep'] as const).map(kind => ({
    kind,
    days: days.filter(day => day[`${kind}Count`] > 0).length,
  }))
  const monday = today.subtract((today.day() + 6) % 7, 'day')
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = monday.add(index, 'day').format('YYYY-MM-DD')
    return buckets.get(date) ?? { date, bodyCount: 0, trainingCount: 0, trainingMinutes: 0, sleepCount: 0, sleepMinutes: 0 }
  })
  return {
    days: heatmap,
    weekDays,
    trainingCount: weekDays.reduce((sum, day) => sum + day.trainingCount, 0),
    trainingMinutes: weekDays.reduce((sum, day) => sum + day.trainingMinutes, 0),
    trainingPercent: percent(weekDays.reduce((sum, day) => sum + day.trainingCount, 0), settings.weeklyTrainingGoalCount),
    durationPercent: percent(weekDays.reduce((sum, day) => sum + day.trainingMinutes, 0), settings.weeklyTrainingGoalMinutes),
    sleepGoalDays: weekDays.filter(day => day.sleepCount > 0 && day.sleepMinutes >= settings.sleepGoalHours * 60).length,
    coverage,
    completeness: Math.round(coverage.reduce((sum, item) => sum + item.days, 0) / 84 * 100),
  }
}
