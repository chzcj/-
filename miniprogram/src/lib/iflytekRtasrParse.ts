/** 解析讯飞实时转写大模型 WebSocket JSON（以真机回包为准） */

type Cw = { w?: string }
type Ws = { cw?: Cw[] }
type Rt = { ws?: Ws[] }
type St = { rt?: Rt[]; type?: string | number }
type Cn = { st?: St }
type AsrData = { cn?: Cn; ls?: boolean }

export type IflytekParseResult = {
  text: string
  /** true=确定性结果(type 0)，false=中间结果(type 1) */
  isFinal: boolean
  sessionId?: string
  isStarted?: boolean
  isError?: boolean
  /** 引擎侧会话结束（含 idle timeout），非用户可见错误 */
  isEnded?: boolean
  errorMessage?: string
}

function collectWords(st?: St): string {
  if (!st?.rt) return ''
  let out = ''
  for (const rt of st.rt) {
    for (const ws of rt.ws || []) {
      for (const cw of ws.cw || []) {
        if (cw.w) out += cw.w
      }
    }
  }
  return out
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/**
 * 实测握手成功包：
 * {"msg_type":"action","data":{"action":"started","sessionId":"..."}}
 * 文档里偶发顶层 action/sid，两种都认。
 */
export function parseIflytekRtasrMessage(raw: string): IflytekParseResult | null {
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }

  const dataObj = asRecord(msg.data)
  const nestedAction = dataObj ? String(dataObj.action || '') : ''
  const topAction = String(msg.action || '')
  const action = nestedAction || topAction

  if (action === 'started') {
    const sessionId =
      (typeof dataObj?.sessionId === 'string' && dataObj.sessionId) ||
      (typeof msg.sessionId === 'string' && msg.sessionId) ||
      (typeof msg.sid === 'string' && msg.sid) ||
      undefined
    return { text: '', isFinal: false, isStarted: true, sessionId }
  }

  if (action === 'error') {
    return {
      text: '',
      isFinal: false,
      isError: true,
      errorMessage: String(
        dataObj?.message ||
          dataObj?.desc ||
          msg.desc ||
          msg.message ||
          dataObj?.code ||
          msg.code ||
          '讯飞识别错误'
      ),
    }
  }

  if (action === 'end') {
    return { text: '', isFinal: false, isEnded: true }
  }

  const msgType = String(msg.msg_type || '')
  const resType = String(msg.res_type || '')
  const looksLikeResult =
    (msgType === 'result' && (resType === 'asr' || !resType)) ||
    action === 'result'

  if (!looksLikeResult) return null

  let parsed: AsrData | null = null
  if (typeof msg.data === 'string') {
    try {
      parsed = JSON.parse(msg.data) as AsrData
    } catch {
      return null
    }
  } else if (dataObj) {
    parsed = dataObj as unknown as AsrData
  }
  if (!parsed) return null

  const st = parsed.cn?.st
  const text = collectWords(st)
  if (!text) return null

  const typeVal = st?.type
  const isFinal = typeVal === 0 || typeVal === '0' || parsed.ls === true
  return { text, isFinal }
}
