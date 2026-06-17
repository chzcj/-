import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function verifyInternalApi(request: Request | NextRequest): boolean {
  const token = internalToken()

  if (!token) {
    return process.env.NODE_ENV === 'development'
  }

  const authHeader = request.headers.get('authorization') || ''
  const apiKeyHeader = request.headers.get('x-api-key') || ''

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  const providedToken = bearerMatch ? bearerMatch[1] : apiKeyHeader

  if (providedToken === token) return true

  const referer = request.headers.get('referer') || ''
  const origin = request.headers.get('origin') || ''
  const host = request.headers.get('host') || ''

  if (referer.includes(host) || origin.includes(host)) return true

  if (process.env.NODE_ENV === 'development') return true

  return false
}

export function verifyAppApi(request: Request | NextRequest): boolean {
  if (hasValidInternalToken(request)) return true
  if (!internalToken() && process.env.NODE_ENV === 'development') return true
  return hasSessionCookie(request) && isSameOriginRequest(request)
}

export function authError() {
  return NextResponse.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API token' } },
    { status: 401 }
  )
}

function hasSessionCookie(request: Request | NextRequest): boolean {
  const cookie = request.headers.get('cookie') || ''
  return cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith('childos_session=') && part.length > 'childos_session='.length)
}

function hasValidInternalToken(request: Request | NextRequest): boolean {
  const token = internalToken()
  if (!token) return false
  const authHeader = request.headers.get('authorization') || ''
  const apiKeyHeader = request.headers.get('x-api-key') || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  const providedToken = bearerMatch ? bearerMatch[1] : apiKeyHeader
  return providedToken === token
}

function internalToken(): string {
  return process.env.INTERNAL_API_TOKEN || process.env.FAST_AI_API_KEY || ''
}

function isSameOriginRequest(request: Request | NextRequest): boolean {
  const requestHost = safeHost(request.url)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestHost
  if (!host) return false
  return [request.headers.get('origin'), request.headers.get('referer')]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      try {
        return new URL(value).host === host
      } catch {
        return value.includes(host)
      }
    })
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
