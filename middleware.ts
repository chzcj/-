import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 仅保留真正需要公开的路径：登录页 + 健康/就绪探针。其余 /api/auth/* 由 isAuth 放行。
// 其它所有受保护路由（含 daily/synthesis/diagnosis/memory/* 等）此前在白名单里靠各自
// verifyAppApi 兜底，但白名单过宽易漏防；现统一由 middleware 要求「有效会话 cookie 或内部 token」，
// 路由内 verifyAppApi 再校验会话真实性（纵深防御）。
const PUBLIC_PATHS = [
  '/login',
  '/api/readiness',
  '/api/health',
]

// 内部 token（服务端脚本/监控用 Authorization: Bearer 或 x-api-key 调用，无 cookie）。
// 与 auth-guard 同源：INTERNAL_API_TOKEN || FAST_AI_API_KEY。仅 token 已配置且精确匹配才放行。
function hasValidInternalToken(request: NextRequest): boolean {
  const internal = process.env.INTERNAL_API_TOKEN || process.env.FAST_AI_API_KEY || ''
  if (!internal) return false
  const authHeader = request.headers.get('authorization') || ''
  const apiKey = request.headers.get('x-api-key') || ''
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || apiKey
  return bearer === internal
}

function getExternalOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return `${proto}://${host}`
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('childos_session')?.value

  const isApiPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isStatic = pathname.startsWith('/_next') || pathname.startsWith('/favicon')
  const isAuth = pathname.startsWith('/api/auth/')

  if (isStatic || isAuth || isApiPublic) return NextResponse.next()

  // 受保护路由：要求有效会话 cookie（存在性，路由内 verifyAppApi 再验真实性）或内部 token。
  if (!token && !hasValidInternalToken(request)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
        { status: 401 }
      )
    }
    return NextResponse.redirect(new URL('/login', getExternalOrigin(request)))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|assets).*)'],
}
