const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  });
}

process.env.NODE_ENV = 'production';
process.chdir(__dirname);

const dir = path.join(__dirname);
const currentPort = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';
const nextConfig = JSON.parse(process.env.__NEXT_PRIVATE_STANDALONE_CONFIG || '{}');

const NextServer = require('next/dist/server/next-server').default;
const nextServer = new NextServer({
  hostname,
  port: currentPort,
  dir,
  conf: nextConfig,
  dev: false,
});

const server = http.createServer((req, res) => {
  nextServer.getRequestHandler()(req, res);
});

function handleAsrWebSocket(socket) {
  const appid = process.env.TENCENT_APPID;
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  if (!appid || !secretId || !secretKey) {
    socket.end(
      'HTTP/1.1 500 Internal Server Error\r\n' +
        'Content-Length: 0\r\n\r\n'
    );
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const expired = timestamp + 86400;
  const nonce = Math.floor(Math.random() * 10000000000);
  const voiceId = crypto.randomUUID();
  const params = {
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
  const queryParts = sortedKeys.map((k) => k + '=' + params[k]);
  const queryString = queryParts.join('&');
  const signStr = 'asr.cloud.tencent.com/asr/v2/' + appid + '?' + queryString;
  const hmac = crypto.createHmac('sha1', secretKey);
  hmac.update(signStr);
  const signature = hmac.digest('base64');
  const encodedSignature = encodeURIComponent(signature);
  const tencentUrl =
    'wss://asr.cloud.tencent.com/asr/v2/' +
    appid +
    '?' +
    queryString +
    '&signature=' +
    encodedSignature;

  const { WebSocket: TencentWS } = require('ws');
  const remote = new TencentWS(tencentUrl);

  let clientClosed = false;
  let remoteClosed = false;

  remote.on('open', () => {
    socket.on('data', onClientData);
  });

  remote.on('message', (data) => {
    if (clientClosed) return;
    const payload = typeof data === 'string' ? data : data.toString();
    sendWsTextFrame(socket, payload);
  });

  remote.on('error', () => {
    if (!clientClosed) {
      sendWsTextFrame(socket, JSON.stringify({ code: -1, message: 'ASR 连接失败' }));
      clientClosed = true;
    }
    socket.end();
  });

  remote.on('close', () => {
    remoteClosed = true;
    if (!clientClosed) socket.end();
  });

  socket.on('close', () => {
    clientClosed = true;
    if (!remoteClosed && remote.readyState === 1) remote.close();
  });

  socket.on('error', () => {
    clientClosed = true;
    if (!remoteClosed && remote.readyState === 1) remote.close();
  });

  let buffer = Buffer.alloc(0);

  function onClientData(chunk) {
    if (clientClosed) return;
    buffer = Buffer.concat([buffer, chunk]);
    while (processBuffer()) {}
  }

  function processBuffer() {
    if (buffer.length < 2) return false;
    const opcode = buffer[0] & 0x0f;
    const masked = (buffer[1] & 0x80) !== 0;
    let payloadLen = buffer[1] & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      if (buffer.length < 4) return false;
      payloadLen = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLen === 127) {
      if (buffer.length < 10) return false;
      payloadLen = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }

    let mask = null;
    if (masked) {
      if (buffer.length < offset + 4) return false;
      mask = [buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]];
      offset += 4;
    }

    if (buffer.length < offset + payloadLen) return false;
    let payload = buffer.slice(offset, offset + payloadLen);
    if (masked && mask) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    }
    buffer = buffer.slice(offset + payloadLen);

    if (opcode === 0x8) {
      clientClosed = true;
      if (!remoteClosed && remote.readyState === 1) remote.close();
      socket.end();
      return false;
    }

    if (opcode === 0x2 && remote.readyState === 1) {
      try {
        const json = JSON.parse(payload.toString());
        if (json.type === 'end') {
          if (!remoteClosed && remote.readyState === 1) remote.close();
          return false;
        }
      } catch {}
      remote.send(payload);
    }

    return true;
  }

  function sendWsTextFrame(wsSocket, data) {
    const payload = Buffer.from(data, 'utf8');
    const length = payload.length;
    let frame;
    if (length < 126) {
      frame = Buffer.alloc(2 + length);
      frame[0] = 0x81;
      frame[1] = length;
      payload.copy(frame, 2);
    } else if (length < 65536) {
      frame = Buffer.alloc(4 + length);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(length, 2);
      payload.copy(frame, 4);
    } else {
      frame = Buffer.alloc(10 + length);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(length), 2);
      payload.copy(frame, 10);
    }
    wsSocket.write(frame);
  }
}

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/api/asr/stream') {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' +
        accept +
        '\r\n\r\n'
    );
    handleAsrWebSocket(socket);
    return;
  }
  socket.destroy();
});

nextServer.prepare().then(() => {
  server.listen(currentPort, hostname, () => {
    console.log('[childos] ws proxy ready on ' + hostname + ':' + currentPort);
  });
});
