import { createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';

export async function GET() {
  const appid = process.env.TENCENT_APPID;
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  if (!appid || !secretId || !secretKey) {
    return Response.json({ ok: false, error: 'ASR 服务未配置。' }, { status: 500 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const expired = timestamp + 86400;
  const nonce = Math.floor(Math.random() * 10000000000);
  const voiceId = randomUUID();

  const params: Record<string, string | number> = {
    secretid: secretId,
    timestamp,
    expired,
    nonce,
    engine_model_type: '16k_zh',
    voice_id: voiceId,
    voice_format: 1,
    needvad: 1,
    filter_dirty: 0,
    filter_modal: 1,
    filter_punc: 1,
    convert_num_mode: 1,
  };

  const sortedKeys = Object.keys(params).sort();
  const queryParts = sortedKeys.map((key) => `${key}=${params[key]}`);
  const queryString = queryParts.join('&');
  const signStr = `asr.cloud.tencent.com/asr/v2/${appid}?${queryString}`;

  const hmac = createHmac('sha1', secretKey);
  hmac.update(signStr);
  const signature = hmac.digest('base64');

  const encodedSignature = encodeURIComponent(signature);
  const wsUrl = `wss://asr.cloud.tencent.com/asr/v2/${appid}?${queryString}&signature=${encodedSignature}`;

  return Response.json({ ok: true, data: { wsUrl } });
}
