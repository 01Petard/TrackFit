export type DomainErrorCode
  = | 'auth.invalidCredentials'
    | 'auth.readOnly'
    | 'data.conflict'
    | 'data.invalid'
    | 'data.readFailed'
    | 'data.versionMissing'
    | 'data.writeFailed'
    | 'metric.codeExists'
    | 'metric.coreImmutable'
    | 'metric.notFound'
    | 'metric.unavailable'
    | 'metric.outOfRange'
    | 'measurement.notFound'
    | 'sleep.notFound'
    | 'training.notFound'
    | 'unknown'

export class TrackFitDomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    readonly values: Record<string, string | number> = {},
  ) {
    super(code)
    this.name = 'TrackFitDomainError'
  }
}
