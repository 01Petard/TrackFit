import { describe, expect, it } from 'vitest'
import {
  dataEtagHeader,
  dataIfMatchHeader,
  dataIfNoneMatchHeader,
  readDataEtag,
  readDataIfMatch,
  readDataIfNoneMatch,
} from '../../shared/utils/data-version'

describe('数据版本请求头', () => {
  it('优先读取未被代理改写的自定义 ETag', () => {
    const headers = new Headers({
      ETag: 'W/"etag-1"',
      [dataEtagHeader]: '"etag-1"',
    })

    expect(readDataEtag(headers)).toBe('"etag-1"')
  })

  it('条件读取和写入优先使用自定义版本头', () => {
    const headers = new Headers({
      'If-Match': 'W/"etag-1"',
      'If-None-Match': 'W/"etag-1"',
      [dataIfMatchHeader]: '"etag-1"',
      [dataIfNoneMatchHeader]: '"etag-1"',
    })

    expect(readDataIfMatch(headers)).toBe('"etag-1"')
    expect(readDataIfNoneMatch(headers)).toBe('"etag-1"')
  })

  it('兼容原有标准 ETag 请求头', () => {
    const headers = new Headers({
      'ETag': '"etag-1"',
      'If-Match': '"etag-1"',
      'If-None-Match': '"etag-1"',
    })

    expect(readDataEtag(headers)).toBe('"etag-1"')
    expect(readDataIfMatch(headers)).toBe('"etag-1"')
    expect(readDataIfNoneMatch(headers)).toBe('"etag-1"')
  })
})
