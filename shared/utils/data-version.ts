export const dataEtagHeader = 'X-TrackFit-ETag'
export const dataIfMatchHeader = 'X-TrackFit-If-Match'
export const dataIfNoneMatchHeader = 'X-TrackFit-If-None-Match'

interface HeaderReader {
  get(name: string): string | null
}

export function readDataEtag(headers: HeaderReader): string {
  return headers.get(dataEtagHeader) ?? headers.get('etag') ?? ''
}

export function readDataIfMatch(headers: HeaderReader): string | null {
  return headers.get(dataIfMatchHeader) ?? headers.get('if-match')
}

export function readDataIfNoneMatch(headers: HeaderReader): string | null {
  return headers.get(dataIfNoneMatchHeader) ?? headers.get('if-none-match')
}

