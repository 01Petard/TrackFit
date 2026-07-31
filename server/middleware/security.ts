import { createError, defineEventHandler, getHeader, getMethod, getRequestURL, setResponseHeader } from 'h3'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'Referrer-Policy', 'same-origin')

  if (SAFE_METHODS.has(getMethod(event))) {
    return
  }

  const origin = getHeader(event, 'origin')
  if (!origin) {
    return
  }

  const requestUrl = getRequestURL(event)
  if (new URL(origin).host !== requestUrl.host) {
    throw createError({ statusCode: 403, statusMessage: '拒绝跨域写入' })
  }
})

