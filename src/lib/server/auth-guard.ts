import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/server/auth'

export function verifyInternalApi(request: Request | NextRequest): boolean {
  const token = internalToken()

  if (!token) {
    // 未配置内部 token：保留 dev 直通 + 同源兜底（精确 host 比较，非子串），
    // 不破坏演示/本地与无 token 部署。
    if (process.env.NODE_ENV === 'development') return true
    return isSameOriginRequest(request)
  }

  // 已配置内部 token：只认 token，杜绝可伪造的 Referer/Origin 同源绕过。
  return hasValidInternalToken(request)
}

export async function verifyAppApi(request: Request | NextRequest): Promise<boolean> {
  // 内部 token（服务端/同进程调用）直通。
  if (hasValidInternalToken(request)) return true
  // 未配置任何内部 token 的本地开发：直通，便于联调。
  if (!internalToken() && process.env.NODE_ENV === 'development') return true
  // 浏览器请求：必须同源，且会话真实有效（demo token 或 DB 中未过期 session）。
  // 仅有 cookie 不算数——伪造的 childos_session 会在 getCurrentUser 校验失败而被拒。
  if (!isSameOriginRequest(request)) return false
  return (await getCurrentUser()) !== undefined
}

export function authError() {
  return NextResponse.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API token' } },
    { status: 401 }
  )
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
