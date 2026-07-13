import { createHash, createHmac } from 'node:crypto'

type TencentConfig = {
  secretId: string
  secretKey: string
}

export type FederationCredentials = {
  tmpSecretId: string
  tmpSecretKey: string
  token: string
  expiredTime: number
}

function signTc3(secretKey: string, date: string, service: string, stringToSign: string) {
  const secretDate = createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const secretService = createHmac('sha256', secretDate).update(service).digest()
  const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest()
  return createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
}

async function callStsApi<T>(
  action: string,
  payload: Record<string, unknown>,
  config: TencentConfig
): Promise<T> {
  const service = 'sts'
  const host = 'sts.tencentcloudapi.com'
  const region = 'ap-guangzhou'
  const version = '2018-08-13'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const body = JSON.stringify(payload)
  const hashedPayload = createHash('sha256').update(body).digest('hex')
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`
  const signedHeaders = 'content-type;host'
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, hashedPayload].join('\n')
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
    throw new Error(err.Message || err.Code || '腾讯云 STS 调用失败')
  }
  if (!json.Response) throw new Error('腾讯云 STS 无响应')
  return json.Response
}

/** 签发仅 asr:* 权限的临时密钥，供小程序插件 setQCloudSecret 使用 */
export async function getAsrFederationCredentials(
  config: TencentConfig,
  durationSeconds = 1800
): Promise<FederationCredentials> {
  const policy = JSON.stringify({
    version: '2.0',
    statement: [
      {
        effect: 'allow',
        action: ['name/asr:*'],
        resource: '*',
      },
    ],
  })
  const res = await callStsApi<{
    Credentials?: {
      Token?: string
      TmpSecretId?: string
      TmpSecretKey?: string
    }
    ExpiredTime?: number
  }>(
    'GetFederationToken',
    {
      Name: 'yujian-asr',
      Policy: policy,
      DurationSeconds: durationSeconds,
    },
    config
  )
  const creds = res.Credentials
  if (!creds?.Token || !creds.TmpSecretId || !creds.TmpSecretKey) {
    throw new Error('STS 未返回完整临时密钥')
  }
  return {
    tmpSecretId: creds.TmpSecretId,
    tmpSecretKey: creds.TmpSecretKey,
    token: creds.Token,
    expiredTime: res.ExpiredTime || 0,
  }
}
