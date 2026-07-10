/** 认证路由结构化日志（不记录密码/完整 token）。 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

export function logAuthEvent(
  route: 'login' | 'register' | 'demo' | 'wechat_login',
  detail: {
    requestId: string
    ip: string
    phone?: string
    outcome: string
    durationMs?: number
    error?: string
  }
) {
  const payload = {
    route,
    requestId: detail.requestId,
    ip: detail.ip,
    phone: detail.phone ? maskPhone(detail.phone) : undefined,
    outcome: detail.outcome,
    durationMs: detail.durationMs,
    error: detail.error,
    unknownIp: detail.ip === 'unknown' ? true : undefined
  }
  if (detail.outcome === 'ok') {
    console.info('[auth]', JSON.stringify(payload))
  } else if (detail.outcome === 'rate_limited') {
    console.warn('[auth]', JSON.stringify(payload))
  } else {
    console.error('[auth]', JSON.stringify(payload))
  }
}
