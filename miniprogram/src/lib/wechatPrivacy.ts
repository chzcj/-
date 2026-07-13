import Taro from '@tarojs/taro'

type PrivacySetting = {
  needAuthorization?: boolean
  privacyContractName?: string
}

/**
 * 隐私 API 必须走微信运行时（wx / Taro 桥）。
 * 不要用「找不到 API 就当作已授权」——那会跳过弹窗，后续录音直接失败。
 *
 * 重要：不要注册 onNeedPrivacyAuthorization——一旦注册，微信会抑制官方隐私弹窗，
 * 改由开发者自绘 UI 负责；而入口组件（app.tsx）在小程序端不渲染 UI，挂在那里的
 * 自绘弹窗永远不可见，authorize 链路会静默挂死。不注册时，调用隐私接口
 * （requirePrivacyAuthorize / authorize 等）微信会自动弹出官方隐私弹窗。
 */
function getPrivacyRuntime(): {
  getPrivacySetting?: typeof Taro.getPrivacySetting
  requirePrivacyAuthorize?: typeof Taro.requirePrivacyAuthorize
  openPrivacyContract?: typeof Taro.openPrivacyContract
} {
  const g = globalThis as typeof globalThis & {
    wx?: {
      getPrivacySetting?: typeof Taro.getPrivacySetting
      requirePrivacyAuthorize?: typeof Taro.requirePrivacyAuthorize
      openPrivacyContract?: typeof Taro.openPrivacyContract
    }
  }
  if (g.wx && typeof g.wx.getPrivacySetting === 'function') {
    return g.wx
  }
  return Taro
}

export function openPrivacyContract() {
  const api = getPrivacyRuntime()
  if (typeof api.openPrivacyContract === 'function') {
    api.openPrivacyContract({})
  }
}

export function getPrivacySetting(): Promise<PrivacySetting> {
  const api = getPrivacyRuntime()
  if (typeof api.getPrivacySetting !== 'function') {
    // API 不可用时不要假装「无需授权」，让后续录音路径自行处理
    return Promise.resolve({ needAuthorization: false })
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // 超时也不要瞎跳过：保守当作仍需授权，由 requirePrivacyAuthorize 再走一轮
      resolve({ needAuthorization: true })
    }, 8000)
    api.getPrivacySetting?.({
      success: (res) => {
        clearTimeout(timer)
        resolve(res || { needAuthorization: false })
      },
      fail: () => {
        clearTimeout(timer)
        resolve({ needAuthorization: true })
      },
    })
  })
}

/** 按住说话前：需已同意《用户隐私保护指引》。未同意时微信弹官方隐私弹窗。 */
export async function ensurePrivacyAuthorized(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const setting = await getPrivacySetting()
  if (!setting.needAuthorization) return { ok: true }

  const api = getPrivacyRuntime()
  if (typeof api.requirePrivacyAuthorize !== 'function') {
    return { ok: false, message: '当前微信版本过低，无法完成隐私授权，请升级微信后再用语音。' }
  }

  return new Promise((resolve) => {
    let settled = false
    const done = (result: { ok: true } | { ok: false; message: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    // 给用户充分时间点同意；仅防止永久挂起
    const timer = setTimeout(() => {
      done({
        ok: false,
        message: '请先同意隐私保护指引后再使用语音。',
      })
    }, 60000)

    api.requirePrivacyAuthorize?.({
      success: () => done({ ok: true }),
      fail: () =>
        done({
          ok: false,
          message: '需同意隐私保护指引后才能使用按住说话。',
        }),
    })
  })
}
