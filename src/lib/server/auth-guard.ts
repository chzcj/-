import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function verifyInternalApi(request: Request | NextRequest): boolean {
  const token = process.env.INTERNAL_API_TOKEN || process.env.FAST_AI_API_KEY || ''

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

export function authError() {
  return NextResponse.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API token' } },
    { status: 401 }
  )
}
