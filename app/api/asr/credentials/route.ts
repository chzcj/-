import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { getAsrFederationCredentials } from '@/lib/server/tencent-sts'
import { ok, fail } from '@/lib/api-response'

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError()

  const appid = process.env.TENCENT_APPID
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY

  if (!appid || !secretId || !secretKey) {
    return fail('ASR_UNCONFIGURED', '语音暂时不可用，可以先打字输入。', undefined, 503)
  }

  try {
    const creds = await getAsrFederationCredentials({ secretId, secretKey })
    return ok({
      appId: appid,
      tmpSecretId: creds.tmpSecretId,
      tmpSecretKey: creds.tmpSecretKey,
      token: creds.token,
      expiredTime: creds.expiredTime,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '临时密钥签发失败'
    return fail('ASR_STS_FAILED', message, undefined, 503)
  }
}
