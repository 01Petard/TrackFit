import type { LocalizedDescriptor } from '../../shared/utils/analytics'
import type { MetricDefinitionDto } from '../../shared/types/api'
import { TrackFitDomainError } from '../../shared/utils/domain-error'

const coreMetricKeys: Record<string, string> = {
  weight: 'metrics.weight',
  body_fat: 'metrics.bodyFat',
  waist: 'metrics.waist',
  hip: 'metrics.hip',
}

export function useTrackFitI18n() {
  const { locale, t } = useI18n()

  function metricName(metric: Pick<MetricDefinitionDto, 'code' | 'name'> & Partial<Pick<MetricDefinitionDto, 'metricType'>>): string {
    const key = metric.metricType !== 'custom' ? coreMetricKeys[metric.code] : undefined
    return key ? t(key) : metric.name
  }

  function formatDescriptor(descriptor: LocalizedDescriptor): string {
    const values = { ...descriptor.values }
    if (typeof values.metricCode === 'string' && typeof values.metricName === 'string') {
      values.metric = coreMetricKeys[values.metricCode] ? t(coreMetricKeys[values.metricCode]!) : values.metricName
      delete values.metricCode
      delete values.metricName
    }
    return t(descriptor.key, values)
  }

  function formatDateTime(value: string | Date): string {
    return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: locale.value === 'zh' ? 'numeric' : 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  }

  function formatError(cause: unknown): string {
    if (cause instanceof TrackFitDomainError) return t(`errors.${cause.code}`, cause.values)
    return t('errors.unknown')
  }

  return { metricName, formatDescriptor, formatDateTime, formatError }
}
