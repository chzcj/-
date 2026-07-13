import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import {
  buildIflytekRtasrWsUrl,
  getIflytekRtasrConfigFromEnv,
} from '@/lib/server/iflytek/rtasr-sign'
import { ok, fail } from '@/lib/api-response'

/** 小程序直连讯飞 wss：服务端签名 URL，密钥不出站 */
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
    return ok({ wsUrl, sessionId })
  } catch (err) {
    const message = err instanceof Error ? err.message : '讯飞签名失败'
    return fail('ASR_SIGN_FAILED', message, undefined, 503)
  }
}
