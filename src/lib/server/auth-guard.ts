import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
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
  // 浏览器请求：必须同源，且会话真实有效（demo token 或 DB 中未过期 session）。
  // 仅有 cookie 不算数——伪造的 childos_session 会在 getCurrentUser 校验失败而被拒。
  if (!isSameOriginRequest(request)) return false
  return (await getCurrentUser()) !== undefined
}

// 管理员专用：在 verifyAppApi 基础上要求会话用户 isAdmin。内部 token / dev 直通不赋予管理员身份，
// 必须是真实 admin 登录会话（demo 账号可由 DEMO_ADMIN/ADMIN_PHONES 提权，便于本地测面板）。
export async function verifyAdminApi(request: Request | NextRequest): Promise<boolean> {
  if (!(await verifyAppApi(request))) return false
  const user = await getCurrentUser()
  return user?.isAdmin === true
}

export function authError() {
  return NextResponse.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API token' } },
    { status: 401 }
  )
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
