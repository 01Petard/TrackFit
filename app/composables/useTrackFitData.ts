import type { MeasurementWrite, MetricCreate, SettingsUpdate, SleepWrite, TrackFitData, TrainingWrite } from '../../shared/schemas/trackfit'
import type { BehaviorQuery } from '../../shared/types/api'
import type { HistoryRecordQuery } from '../../shared/utils/history'
import type { MeasurementQuery } from '../../shared/utils/trackfit'
import { backupSchema } from '../../shared/schemas/trackfit'
import { TrackFitDomainError } from '../../shared/utils/domain-error'
import { dataIfMatchHeader, dataIfNoneMatchHeader, readDataEtag } from '../../shared/utils/data-version'
import { listHistoryRecords as listHistoryRecordsFromData } from '../../shared/utils/history'
import {
  buildBehaviorCorrelations,
  buildPeriodReport,
  createSleepCsv,
  createTrainingCsv,
  deleteSleep as deleteSleepInData,
  deleteTraining as deleteTrainingInData,
  listBehaviorTimeline,
  saveSleep as saveSleepInData,
  saveTraining as saveTrainingInData,
} from '../../shared/utils/behavior'
import {
  createCsv,
  createMetric as createMetricInData,
  deleteMeasurement as deleteMeasurementInData,
  getAnalytics as getAnalyticsFromData,
  getMetrics,
  getSettings,
  listMeasurements as listMeasurementsFromData,
  saveMeasurement as saveMeasurementInData,
  saveSettings as saveSettingsInData,
  updateMetric as updateMetricInData,
} from '../../shared/utils/trackfit'

type LoadStatus = 'idle' | 'pending' | 'success' | 'error'

let loadPromise: Promise<void> | undefined
let operationQueue = Promise.resolve()
let saving = false

export function useTrackFitData() {
  const { user } = useUserSession()
  const data = useState<TrackFitData | null>('trackfit-data', () => null)
  const etag = useState('trackfit-etag', () => '')
  const status = useState<LoadStatus>('trackfit-status', () => 'idle')
  const error = useState('trackfit-error', () => '')
  const writable = useState<boolean | null>('trackfit-writable', () => null)
  const conflictCount = useState('trackfit-conflicts', () => 0)
  const canWrite = computed(() => user.value?.role === 'admin')

  const metrics = computed(() => data.value ? getMetrics(data.value) : [])
  const settings = computed(() => data.value ? getSettings(data.value) : getSettings(emptyData()))

  async function ensureLoaded(): Promise<void> {
    if (data.value) return
    if (!loadPromise) {
      loadPromise = refresh(true).finally(() => {
        loadPromise = undefined
      })
    }
    return loadPromise
  }

  async function refresh(force = false): Promise<void> {
    if (saving) return
    if (!data.value) status.value = 'pending'
    try {
      const response = await fetch('/api/data', {
        cache: 'no-store',
        headers: !force && etag.value ? { [dataIfNoneMatchHeader]: etag.value } : undefined,
      })
      if (response.status === 304) {
        status.value = 'success'
        return
      }
      if (!response.ok) throw await responseError(response, 'data.readFailed')
      data.value = backupSchema.parse(await response.json())
      etag.value = readDataEtag(response.headers)
      writable.value = response.headers.get('x-trackfit-writable') === 'true'
      status.value = 'success'
      error.value = ''
    } catch (cause) {
      status.value = 'error'
      error.value = getErrorMessage(cause)
      throw cause
    }
  }

  function mutate<T>(operation: (draft: TrackFitData) => T): Promise<T> {
    if (!canWrite.value) return Promise.reject(new TrackFitDomainError('auth.readOnly'))
    let resolveResult: (result: T) => void
    let rejectResult: (reason: unknown) => void
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })
    operationQueue = operationQueue.then(async () => {
      try {
        await ensureLoaded()
        for (let attempt = 0; attempt < 2; attempt++) {
          const draft = structuredClone(toRaw(data.value!))
          const operationResult = operation(draft)
          draft.exportedAt = new Date().toISOString()
          try {
            await persist(backupSchema.parse(draft))
            resolveResult(operationResult)
            return
          } catch (cause) {
            if (!(cause instanceof DataConflictError) || attempt === 1) throw cause
            conflictCount.value++
            await refresh(true)
          }
        }
      } catch (cause) {
        rejectResult(cause)
      }
    })
    return result
  }

  async function persist(candidate: TrackFitData): Promise<void> {
    saving = true
    try {
      const response = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', [dataIfMatchHeader]: etag.value },
        body: JSON.stringify(candidate),
      })
      if (response.status === 409) throw new DataConflictError()
      if (!response.ok) throw await responseError(response, 'data.writeFailed')
      data.value = backupSchema.parse(await response.json())
      etag.value = readDataEtag(response.headers)
      writable.value = response.headers.get('x-trackfit-writable') === 'true'
      status.value = 'success'
      error.value = ''
    } finally {
      saving = false
    }
  }

  return {
    data: readonly(data),
    status: readonly(status),
    error: readonly(error),
    writable: readonly(writable),
    canWrite: readonly(canWrite),
    conflictCount: readonly(conflictCount),
    metrics,
    settings,
    ensureLoaded,
    refresh,
    listMeasurements: (query: MeasurementQuery) => data.value ? listMeasurementsFromData(data.value, query) : emptyPage(query),
    getAnalytics: (metricCode: string, start?: string, end?: string) => data.value ? getAnalyticsFromData(data.value, metricCode, start, end) : null,
    createMetric: (input: MetricCreate) => mutate(draft => createMetricInData(draft, input)),
    updateMetric: (id: number, patch: unknown) => mutate(draft => updateMetricInData(draft, id, patch)),
    saveSettings: (input: SettingsUpdate) => mutate(draft => saveSettingsInData(draft, input)),
    saveMeasurement: (input: MeasurementWrite | unknown, id?: number) => mutate(draft => saveMeasurementInData(draft, input, id)),
    deleteMeasurement: (id: number) => mutate(draft => deleteMeasurementInData(draft, id)),
    listBehaviors: (query?: BehaviorQuery) => data.value ? listBehaviorTimeline(data.value, query) : [],
    listHistoryRecords: (query?: HistoryRecordQuery) => data.value ? listHistoryRecordsFromData(data.value, query) : [],
    saveTraining: (input: TrainingWrite | unknown, id?: number) => mutate(draft => saveTrainingInData(draft, input, id)),
    deleteTraining: (id: number) => mutate(draft => deleteTrainingInData(draft, id)),
    saveSleep: (input: SleepWrite | unknown, id?: number) => mutate(draft => saveSleepInData(draft, input, id)),
    deleteSleep: (id: number) => mutate(draft => deleteSleepInData(draft, id)),
    getBehaviorCorrelations: () => data.value ? buildBehaviorCorrelations(data.value) : [],
    getPeriodReport: (period: 'week' | 'month', now?: Date) => data.value ? buildPeriodReport(data.value, period, now) : null,
    restore: (input: unknown) => {
      const restored = backupSchema.parse(input)
      return mutate((draft) => {
        Object.assign(draft, structuredClone(restored))
      })
    },
    exportJson: () => JSON.stringify({ ...data.value!, exportedAt: new Date().toISOString() }, null, 2),
    exportCsv: (locale: 'zh' | 'en' = 'zh') => data.value ? createCsv(data.value, locale) : '',
    exportTrainingCsv: (locale: 'zh' | 'en' = 'zh') => data.value ? createTrainingCsv(data.value, locale) : '',
    exportSleepCsv: (locale: 'zh' | 'en' = 'zh') => data.value ? createSleepCsv(data.value, locale) : '',
  }
}

class DataConflictError extends TrackFitDomainError {
  constructor() {
    super('data.conflict')
  }
}

async function responseError(response: Response, fallback: ConstructorParameters<typeof TrackFitDomainError>[0]): Promise<TrackFitDomainError> {
  const payload = await response.json().catch(() => null) as { data?: { code?: ConstructorParameters<typeof TrackFitDomainError>[0] } } | null
  return new TrackFitDomainError(payload?.data?.code ?? fallback)
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'unknown'
}

function emptyData(): TrackFitData {
  return { version: 6, exportedAt: new Date(0).toISOString(), settings: [], metrics: [], bodyRecords: [], trainingRecords: [], sleepRecords: [] }
}

function emptyPage(query: MeasurementQuery) {
  return { items: [], total: 0, page: query.page, pageSize: query.pageSize }
}
