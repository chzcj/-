import Taro from '@tarojs/taro'

type PrivacyResolve = (result: { event: 'agree' | 'disagree'; buttonId?: string }) => void

type PrivacySetting = {
  needAuthorization?: boolean
  privacyContractName?: string
}

type WechatPrivacyApi = {
  getPrivacySetting?: (option: {
    success?: (res: PrivacySetting) => void
    fail?: () => void
  }) => void
  requirePrivacyAuthorize?: (option: {
    success?: () => void
    fail?: () => void
  }) => void
  openPrivacyContract?: (option?: { fail?: () => void }) => void
  onNeedPrivacyAuthorization?: (listener: (resolve: PrivacyResolve) => void) => void
  offNeedPrivacyAuthorization?: (listener: (resolve: PrivacyResolve) => void) => void
}

function privacyApi(): WechatPrivacyApi {
  return Taro as unknown as WechatPrivacyApi
}

let pendingResolve: PrivacyResolve | null = null
let modalVisible = false
const modalListeners = new Set<(visible: boolean) => void>()

function setModalVisible(visible: boolean) {
  modalVisible = visible
  modalListeners.forEach((fn) => fn(visible))
}

export function subscribePrivacyModal(listener: (visible: boolean) => void): () => void {
  listener(modalVisible)
  modalListeners.add(listener)
  return () => modalListeners.delete(listener)
}

export function initPrivacyAuthorization() {
  const api = privacyApi()
  if (typeof api.onNeedPrivacyAuthorization !== 'function') return

  api.onNeedPrivacyAuthorization((resolve) => {
    pendingResolve = resolve
    setModalVisible(true)
  })
}

export function agreePrivacyAuthorization(buttonId: string) {
  pendingResolve?.({ event: 'agree', buttonId })
  pendingResolve = null
  setModalVisible(false)
}

export function disagreePrivacyAuthorization() {
  pendingResolve?.({ event: 'disagree' })
  pendingResolve = null
  setModalVisible(false)
}

export function openPrivacyContract() {
  const api = privacyApi()
  if (typeof api.openPrivacyContract === 'function') {
    api.openPrivacyContract({})
  }
}

export function getPrivacySetting(): Promise<PrivacySetting> {
  const api = privacyApi()
  if (typeof api.getPrivacySetting !== 'function') {
    return Promise.resolve({ needAuthorization: false })
  }
  return new Promise((resolve) => {
    api.getPrivacySetting?.({
      success: (res) => resolve(res || { needAuthorization: false }),
      fail: () => resolve({ needAuthorization: false }),
    })
  })
}

/** 按住说话前：需已同意《用户隐私保护指引》 */
export async function ensurePrivacyAuthorized(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const setting = await getPrivacySetting()
  if (!setting.needAuthorization) return { ok: true }

  const api = privacyApi()
  if (typeof api.requirePrivacyAuthorize !== 'function') {
    setModalVisible(true)
    return { ok: false, message: '需同意隐私保护指引后才能使用语音功能。' }
  }

  return new Promise((resolve) => {
    api.requirePrivacyAuthorize?.({
      success: () => resolve({ ok: true }),
      fail: () =>
        resolve({
          ok: false,
          message: '需同意隐私保护指引后才能使用按住说话。',
        }),
    })
  })
}
