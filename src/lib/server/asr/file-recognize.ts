import { createHash, createHmac, randomUUID } from 'node:crypto'

type TencentAsrConfig = {
  appid: string
  secretId: string
  secretKey: string
}

function getAsrConfig(): TencentAsrConfig | null {
  const appid = process.env.TENCENT_APPID
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  if (!appid || !secretId || !secretKey) return null
  return { appid, secretId, secretKey }
}

/** TC3-HMAC-SHA256 签名，调用 asr.tencentcloudapi.com */
function signTc3(secretKey: string, date: string, service: string, stringToSign: string) {
  const secretDate = createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const secretService = createHmac('sha256', secretDate).update(service).digest()
  const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest()
  return createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
}

async function callAsrApi<T>(
  action: string,
  payload: Record<string, unknown>,
  config: TencentAsrConfig
): Promise<T> {
  const service = 'asr'
  const host = 'asr.tencentcloudapi.com'
  const region = 'ap-guangzhou'
  const version = '2019-06-14'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const body = JSON.stringify(payload)
  const hashedPayload = createHash('sha256').update(body).digest('hex')
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`
  const signedHeaders = 'content-type;host'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')
  const signature = signTc3(config.secretKey, date, service, stringToSign)
  const authorization = `TC3-HMAC-SHA256 Credential=${config.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Host: host,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': version,
      'X-TC-Region': region,
      Authorization: authorization,
    },
    body,
  })
  const json = (await res.json()) as {
    Response?: T & { Error?: { Code?: string; Message?: string } }
  }
  if (json.Response?.Error) {
    const err = json.Response.Error
    throw new Error(err.Message || err.Code || '腾讯云 ASR 调用失败')
  }
  if (!json.Response) throw new Error('腾讯云 ASR 无响应')
  return json.Response
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * 录音文件识别（非实时）：CreateRecTask + 轮询 DescribeTaskStatus。
 * 与实时 WebSocket 共用 TENCENT_APPID / SECRET_*，但计费资源包独立。
 * 引擎用标准 16k_zh（非 large），抵扣「录音文件识别」资源包。
 */
export async function recognizeAudioFile(args: {
  base64Data: string
  /** 原始字节长度 */
  dataLen: number
  /** 如 mp3 / aac / wav / pcm */
  voiceFormat?: string
  maxWaitMs?: number
}): Promise<string> {
  const config = getAsrConfig()
  if (!config) {
    throw new Error('ASR_UNCONFIGURED')
  }

  const created = await callAsrApi<{ Data?: { TaskId?: number } }>(
    'CreateRecTask',
    {
      EngineModelType: '16k_zh',
      ChannelNum: 1,
      ResTextFormat: 0,
      SourceType: 1,
      Data: args.base64Data,
      DataLen: args.dataLen,
      VoiceFormat: args.voiceFormat || 'mp3',
    },
    config
  )

  const taskId = created.Data?.TaskId
  if (!taskId) throw new Error('创建转写任务失败')

  const maxWait = args.maxWaitMs ?? 120_000
  const started = Date.now()
  while (Date.now() - started < maxWait) {
    await sleep(1500)
    const status = await callAsrApi<{
      Data?: {
        Status?: number
        StatusStr?: string
        Result?: string
        ErrorMsg?: string
      }
    }>('DescribeTaskStatus', { TaskId: taskId }, config)

    const data = status.Data
    if (!data) continue
    // 0等待 1执行中 2成功 3失败
    if (data.Status === 2) {
      const text = String(data.Result || '').trim()
      if (!text) throw new Error('转写结果为空')
      return text
    }
    if (data.Status === 3) {
      throw new Error(data.ErrorMsg || '转写失败')
    }
  }
  throw new Error('转写超时，请重试')
}

export function newDialogueAnalysisId() {
  return `da_${randomUUID().replace(/-/g, '').slice(0, 20)}`
}

export function isAsrConfigured() {
  return Boolean(getAsrConfig())
}
