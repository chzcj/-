import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import {
  buildIflytekRtasrWsUrl,
  getIflytekRtasrConfigFromEnv,
} from '@/lib/server/iflytek/rtasr-sign'
import { ok, fail } from '@/lib/api-response'

/** 小程序直连讯飞 wss：服务端签名 URL，密钥不出站 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const config = getIflytekRtasrConfigFromEnv()
  if (!config) {
    return fail(
      'ASR_UNCONFIGURED',
      '语音暂时不可用，可以先打字输入。',
      undefined,
      503
    )
  }

  try {
    const { wsUrl, sessionId } = buildIflytekRtasrWsUrl(config)
    // 直连讯飞 wss；签名仅可使用一次，禁止中间层缓存。
    const response = ok({ wsUrl, sessionId })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : '讯飞签名失败'
    return fail('ASR_SIGN_FAILED', message, undefined, 503)
  }
}
