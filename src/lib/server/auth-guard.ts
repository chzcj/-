import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/server/auth'

export function verifyInternalApi(request: Request | NextRequest): boolean {
  const token = internalToken()

  if (!token) {
    // 未配置内部 token：仅 dev 直通便于本地联调；prod 一律拒绝。
    // 同源 Referer/Origin/Host 全是可伪造的请求头，不能作为内部端点的凭据。
    return process.env.NODE_ENV === 'development'
  }

  // 已配置内部 token：只认 token，杜绝可伪造的 Referer/Origin 同源绕过。
  return hasValidInternalToken(request)
}

export async function verifyAppApi(request: Request | NextRequest): Promise<boolean> {
  // 内部 token（服务端/同进程调用）直通。
  if (hasValidInternalToken(request)) return true
  // 未配置任何内部 token 的本地开发：直通，便于联调。
  if (!internalToken() && process.env.NODE_ENV === 'development') return true

  const user = await getCurrentUser()
  if (user !== undefined) {
    // 已登录：优先信任会话。部分 WebView 可能不带 Origin/Referer，不应因此拦 hydration。
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    if (!origin && !referer) return true
    return isSameOriginRequest(request)
  }

  return false
}

// 管理员专用：在 verifyAppApi 基础上要求会话用户 isAdmin。内部 token / dev 直通不赋予管理员身份；
// 必须是真实 admin 登录会话（ADMIN_PHONES 白名单）。Demo 会话永无 admin。
export async function verifyAdminApi(request: Request | NextRequest): Promise<boolean> {
  if (!(await verifyAppApi(request))) return false
  const user = await getCurrentUser()
  return user?.isAdmin === true
}

export function authError() {
  return fail('UNAUTHORIZED', '请先登录', undefined, 401)
}

export function forbiddenError() {
  return NextResponse.json(
    { ok: false, error: { code: 'FORBIDDEN', message: '需要管理员权限' } },
    { status: 403 }
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
