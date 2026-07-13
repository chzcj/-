import Taro from '@tarojs/taro'
import { ensurePrivacyAuthorized } from '@/lib/wechatPrivacy'

export type RecordAuthStatus = 'granted' | 'denied' | 'unknown'

function readRecordAuth(authSetting: Record<string, boolean | undefined>): RecordAuthStatus {
  const value = authSetting['scope.record']
  if (value === true) return 'granted'
  if (value === false) return 'denied'
  return 'unknown'
}

/** 只读当前麦克风授权状态（不弹窗） */
export async function getRecordAuthStatus(): Promise<RecordAuthStatus> {
  try {
    const { authSetting } = await Taro.getSetting()
    return readRecordAuth(authSetting as Record<string, boolean | undefined>)
  } catch {
    return 'unknown'
  }
}

function authorizeRecord(): Promise<void> {
  return new Promise((resolve, reject) => {
    Taro.authorize({
      scope: 'scope.record',
      success: () => resolve(),
      fail: (err) => reject(err || new Error('authorize failed')),
    })
  })
}

/**
 * 申请麦克风权限。
 * - 禁止对 authorize 做短超时 race：用户点「允许」常超过数秒，race 会制造 SystemError timeout，并误判失败。
 * - interactive=true 时用弹窗引导（适合按住说话前的首次授权，避免按住过程中弹窗被松手打断）。
 */
export async function ensureRecordPermission(options?: {
  interactive?: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const interactive = options?.interactive ?? false

  // 已授权的快路径：能拿到 scope.record 必然已过隐私关，无需再走隐私检查
  //（省去每次按住的 getPrivacySetting 往返，也避免隐私接口异常时把已授权用户卡住）
  let status = await getRecordAuthStatus()
  if (status === 'granted') return { ok: true }

  const privacy = await ensurePrivacyAuthorized()
  if (!privacy.ok) return privacy

  if (status === 'denied') {
    if (!interactive) {
      return { ok: false, message: '麦克风权限已关闭，请在设置中开启后再按住说话。' }
    }
    try {
      const modal = await Taro.showModal({
        title: '需要麦克风权限',
        content: '语音输入需要使用麦克风。请在设置中允许「录音」后回来再按住说话。',
        confirmText: '去设置',
        cancelText: '取消',
      })
      if (!modal.confirm) {
        return { ok: false, message: '未开启麦克风权限，可先点「文」打字。' }
      }
      const opened = await Taro.openSetting()
      if (opened.authSetting?.['scope.record']) return { ok: true }
      return { ok: false, message: '麦克风权限没有打开，可在设置中允许后再试。' }
    } catch {
      return { ok: false, message: '无法打开设置页，请在微信里手动允许麦克风。' }
    }
  }

  // unknown：尚未询问过
  if (interactive) {
    try {
      const modal = await Taro.showModal({
        title: '允许使用麦克风',
        content: '按住说话需要麦克风权限，用于把语音转成文字。下一步将弹出系统授权。',
        confirmText: '去允许',
        cancelText: '取消',
      })
      if (!modal.confirm) {
        return { ok: false, message: '未授权麦克风，可先点「文」打字。' }
      }
    } catch {
      /* 继续走系统 authorize */
    }
  }

  try {
    await authorizeRecord()
  } catch {
    status = await getRecordAuthStatus()
    if (status === 'granted') return { ok: true }
    if (status === 'denied') {
      return {
        ok: false,
        message: interactive
          ? '麦克风权限被拒绝，可在设置中开启，或点「文」打字。'
          : '麦克风权限没有打开，请允许后再按住说话。',
      }
    }
    return { ok: false, message: '麦克风授权失败，请重试或点「文」打字。' }
  }

  status = await getRecordAuthStatus()
  if (status === 'granted') return { ok: true }

  // 少数机型 authorize success 后 getSetting 仍短暂 unknown：再信一次 authorize 结果
  return { ok: true }
}
