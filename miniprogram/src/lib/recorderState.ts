import Taro from '@tarojs/taro'

/**
 * 全局录音器控制器（微信 RecorderManager 是全局唯一实例）。
 *
 * 微信回调全局只注册一次，按 currentOwner 分发——避免「每次开录重绑」在叠加语义下叠帧。
 *
 * 关键：claim 带所有权 id。预演页 HiFiInputZone 在 navigateTo 后仍存活，
 * 其实时 ASR 的握手超时 / cleanup 若无条件 stop()，会掐死亲子页整段录音。
 * 失权后一律不得再 stop / 不得再吃 onError。
 */

export type RecorderHandlers = {
  onFrame?: (frameBuffer: ArrayBuffer) => void
  onStop?: (res: { tempFilePath?: string }) => void
  onError?: (err: { errMsg?: string }) => void
}

export type RecorderClaim = {
  id: number
  /** 是否仍是当前录音回调归属方 */
  isMine: () => boolean
}

export const recorderState = {
  /** 是否有录音在跑（谁 start 谁置 true；本轮有效 stop/onStop/onError 置 false） */
  active: false,
}

let wxCallbacksBound = false
let currentOwner: RecorderHandlers | null = null
let currentClaimId = 0
let nextClaimId = 0

function recorderTrace(event: string, extra?: Record<string, unknown>) {
  console.info('[recorder-state]', event, {
    active: recorderState.active,
    claimId: currentClaimId || null,
    hasOwner: Boolean(currentOwner),
    ...extra,
  })
}

/** 仅用于诊断与安全接管：不能根据 active 猜测全局 RecorderManager 是否真的在录。 */
export function getRecorderSnapshot() {
  return {
    active: recorderState.active,
    claimId: currentClaimId || null,
    hasOwner: Boolean(currentOwner),
  }
}

function bindWxCallbacksOnce() {
  if (wxCallbacksBound) return
  wxCallbacksBound = true
  const recorder = Taro.getRecorderManager()
  recorder.onFrameRecorded((res) => {
    if (res.frameBuffer) currentOwner?.onFrame?.(res.frameBuffer)
  })
  recorder.onStop((res) => {
    recorderTrace('wx onStop', { tempFilePath: res?.tempFilePath || '' })
    currentOwner?.onStop?.(res || {})
  })
  recorder.onError((err) => {
    recorderTrace('wx onError', { errMsg: err?.errMsg || '' })
    currentOwner?.onError?.(err || {})
  })
}

/** 开录前调用：注册全局回调（幂等）并声明本次录音的回调归属。 */
export function claimRecorder(handlers: RecorderHandlers): RecorderClaim {
  bindWxCallbacksOnce()
  const id = ++nextClaimId
  currentClaimId = id
  currentOwner = handlers
  recorderTrace('claim', { claimId: id })
  return {
    id,
    isMine: () => currentClaimId === id && currentOwner === handlers,
  }
}

/** 页面卸载等场景释放所有权（仅当仍归自己时）。 */
export function releaseRecorder(handlers: RecorderHandlers) {
  if (currentOwner === handlers) {
    recorderTrace('release owner')
    currentOwner = null
  }
}

export function releaseRecorderClaim(claim: RecorderClaim | null | undefined) {
  if (claim?.isMine()) {
    recorderTrace('release claim', { claimId: claim.id })
    currentOwner = null
  }
}
