/**
 * 统一自定义服务器：托管 Next（dev / prod 均可）+ /api/asr/stream WebSocket（腾讯云实时 ASR 代理）。
 *
 * 为什么要它：/api/asr/stream 不是 Next route，next dev / next start 默认不带 WS upgrade handler，
 * 语音转写连不上。本文件用标准 next() 程序化 API（不依赖已移除的 output:standalone），在同一个
 * http server 上挂载 ASR 的 upgrade，复用 asr-proxy.js 的腾讯代理逻辑（ws 库，避免手写帧解析）。
 *
 * 跑法：
 *   开发：npm run asr:dev     （热重载，本地看转写最方便）
 *   生产：npm run build && npm run asr:start
 * 凭证：在 .env.local 配 TENCENT_APPID / TENCENT_SECRET_ID / TENCENT_SECRET_KEY（腾讯云「实时语音识别」）。
 */
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer, WebSocket } = require('ws')

// 先加载 .env.local：next 自身会读，但 WS 代理运行在 Next 之外，也要拿到 TENCENT_* / PORT。
loadEnvLocal()

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT, 10) || 3000
const hostname = process.env.HOSTNAME || '0.0.0.0'

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  })

  // /api/asr/stream：浏览器 PCM 流 ↔ 腾讯云实时 ASR。noServer 模式，仅接管该路径的 upgrade。
  const wss = new WebSocketServer({ noServer: true })
  wss.on('connection', handleAsrConnection)

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url)
    if (pathname === '/api/asr/stream') {
      wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req))
    } else {
      socket.destroy()
    }
  })

  server.listen(port, hostname, () => {
    console.log(
      `[childos] ready on http://${hostname}:${port}  ·  ASR ws: /api/asr/stream  ·  ${dev ? 'dev' : 'prod'}`
    )
  })
})

/**
 * 单个浏览器连接 → 起一条到腾讯云的 ASR WebSocket，做双向透传。
 * 复用 asr-proxy.js 的签名与协议；引擎沿用 server-ws.js 的 16k_zh_large（中文大模型，质量更好）。
 */
function handleAsrConnection(client) {
  const appid = process.env.TENCENT_APPID
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY

  if (!appid || !secretId || !secretKey) {
    // 没配凭证：明确回错（前端会把它显示为可见降级提示），不静默挂死。
    safeSend(client, JSON.stringify({ code: -1, message: 'ASR 未配置：缺少 TENCENT_APPID / TENCENT_SECRET_ID / TENCENT_SECRET_KEY' }))
    client.close()
    return
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const expired = timestamp + 86400
  const nonce = Math.floor(Math.random() * 1e10)
  const voiceId = crypto.randomUUID()
  const params = {
    secretid: secretId,
    timestamp,
    expired,
    nonce,
    engine_model_type: '16k_zh_large',
    voice_id: voiceId,
    voice_format: 1,
    needvad: 1,
    filter_dirty: 0,
    filter_modal: 1,
    filter_punc: 1,
    convert_num_mode: 1,
  }
  const queryString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const signStr = `asr.cloud.tencent.com/asr/v2/${appid}?${queryString}`
  const signature = encodeURIComponent(crypto.createHmac('sha1', secretKey).update(signStr).digest('base64'))
  const tencentUrl = `wss://asr.cloud.tencent.com/asr/v2/${appid}?${queryString}&signature=${signature}`

  const remote = new WebSocket(tencentUrl)
  let ended = false

  remote.on('open', () => {
    client.on('message', (data, isBinary) => {
      if (ended) return
      // 文本帧只可能是 {type:'end'}：通知腾讯结束。其余二进制帧为 PCM 音频，直接透传。
      if (!isBinary) {
        try {
          if (JSON.parse(data.toString()).type === 'end') {
            ended = true
            if (remote.readyState === WebSocket.OPEN) remote.close()
            return
          }
        } catch {}
      }
      if (remote.readyState === WebSocket.OPEN) remote.send(data, { binary: isBinary })
    })
  })

  // 腾讯返回的识别 JSON 原样回帧给浏览器（前端按 voice_text_str / slice_type 解析）。
  remote.on('message', (data) => {
    if (!ended) safeSend(client, typeof data === 'string' ? data : data.toString())
  })

  remote.on('error', () => {
    if (!ended) {
      safeSend(client, JSON.stringify({ code: -1, message: 'ASR 连接失败' }))
      ended = true
    }
    try { client.close() } catch {}
  })

  remote.on('close', () => {
    ended = true
    try { client.close() } catch {}
  })

  client.on('close', () => {
    ended = true
    if (remote.readyState === WebSocket.OPEN) remote.close()
  })

  client.on('error', () => {
    ended = true
    if (remote.readyState === WebSocket.OPEN) remote.close()
  })
}

function safeSend(ws, payload) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  } catch {}
}

/** 轻量加载 .env.local（不引第三方依赖）；已存在的环境变量优先，不覆盖。 */
function loadEnvLocal() {
  const p = path.join(__dirname, '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}
