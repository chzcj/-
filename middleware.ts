import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/demo',
  '/api/auth/login',
  '/api/auth/register',
  '/api/readiness',
  '/api/health',
  '/api/entry/analyze',
  '/api/synthesis',
  '/api/diagnosis',
  '/api/daily',
  '/api/memory/retrieve',
  '/api/memory/write',
  '/api/rehearsal/analyze',
  '/api/profile/snapshot',
  '/api/profile/weekly-review',
]

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

  if (!token) {
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
