const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const appid = process.env.TENCENT_APPID;
const secretId = process.env.TENCENT_SECRET_ID;
const secretKey = process.env.TENCENT_SECRET_KEY;
const port = parseInt(process.env.ASR_PROXY_PORT, 10) || 3001;

if (!appid || !secretId || !secretKey) {
  console.error('[asr-proxy] missing TENCENT_ env vars');
  process.exit(1);
}

const wss = new WebSocketServer({ host: '127.0.0.1', port });

wss.on('connection', (client) => {
  const ts = Math.floor(Date.now() / 1000), exp = ts + 86400, nonce = Math.floor(Math.random() * 1e10);
  const vid = crypto.randomUUID();
  const params = { secretid: secretId, timestamp: ts, expired: exp, nonce, engine_model_type: '16k_zh', voice_id: vid, voice_format: 1, needvad: 1, filter_dirty: 0, filter_modal: 1, filter_punc: 1, convert_num_mode: 1 };
  const qs = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&');
  const sigRaw = 'asr.cloud.tencent.com/asr/v2/' + appid + '?' + qs;
  const sig = encodeURIComponent(crypto.createHmac('sha1', secretKey).update(sigRaw).digest('base64'));
  const turl = 'wss://asr.cloud.tencent.com/asr/v2/' + appid + '?' + qs + '&signature=' + sig;

  const { WebSocket: TencentWS } = require('ws');
  const remote = new TencentWS(turl);

  let ended = false;

  remote.on('open', () => {
    client.on('message', (data, isBinary) => {
      if (ended) return;
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'end') {
            remote.close();
            ended = true;
            return;
          }
        } catch (_) {}
      }
      if (remote.readyState === 1) {
        remote.send(data, { binary: isBinary });
      }
    });
  });

  remote.on('message', (data) => {
    if (!ended) client.send(typeof data === 'string' ? data : data.toString());
  });

  remote.on('error', () => {
    if (!ended) { client.send(JSON.stringify({ code: -1, message: 'ASR error' })); ended = true; }
    client.close();
  });

  remote.on('close', () => { ended = true; client.close(); });
  client.on('close', () => { ended = true; if (remote.readyState === 1) remote.close(); });
});

wss.on('listening', () => {
  console.log('[asr-proxy] listening on :' + port);
});
